import {
  getCurrentEightCharJSON,
  getLiuYueForYear as _getLiuYueForYear,
  getLiuRiForRange as _getLiuRiForRange,
  getLiuShiForDay as _getLiuShiForDay,
  getShiChenName,
} from './engine/mystilight/ext';
import type { EightCharJSON } from './engine/mystilight/ext';
import { resolveTrueSolarInput } from './engine/solar';
import { buildWuYunLiuQiExport } from './wuyunliuqi';
import { buildLifeKline } from './lifekline';
import { analyzeTiaoHou } from './tiaohou';
import { computeSiLing } from './siling';
import { detectPatterns } from './patterns';
import { analyzeGeJu } from './geju';
import { getZipingClassic } from './zipingzhenquan';
import { buildDecadePlan } from './decadeplan';
import { detectYunPatterns } from './yunpatterns';
import { buildYongShenSanFa } from './yongshen';
import { getDiShi } from './utils';
import { collectShenShaNames, lookupShenShaMeanings } from './shensha-dict';
import { buildXiangFaExport } from './xiangfa';

// ─── Re-export 引擎扩展 API 供组件使用 ─────────────────
// 原 fork（mystilight-8char-v2）的 v2 能力已内置为应用内扩展层 engine/mystilight/ext，
// 上游改为 npm 直接依赖 mystilight-8char，组件侧 API 保持不变。

export { getShiShen, getLiuYueForYear, getLiuRiForMonth, getLiuRiForRange, getLiuShiForDay, getShiChenName } from './engine/mystilight/ext';
export { TIAN_GAN, DI_ZHI, JIA_ZI_60 } from './engine/mystilight/ext';
export { lunarToSolar, getLunarLeapMonth, reverseLookupBazi } from './engine/mystilight/ext';

export type { LiuYueItem, LiuRiItem, LiuShiItem, ReverseLookupResult } from './engine/mystilight/ext';

// ─── 应用层接口 ──────────────────────────────────────

export interface BaziInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  gender: 0 | 1;
  sect: 1 | 2;
  /** 姓名（选填）：进导出文件名与盘面基本信息，便于多人多盘区分（口径同 react-zwds） */
  name?: string;
  city?: string;
  longitude?: number;
  /** 出生地纬度（用于地利寒热判断，南正北负？——统一北纬为正）；城市模式按省级取，手动可填 */
  latitude?: number;
  /** 出生地时区 UTC 偏移（小时，如东京 9、纽约 -5）；缺省 8（北京时）。仅手动经度时需指定 */
  utcOffset?: number;
  livingPlace?: string;
  userNote?: string;
  /** 排盘引擎（缺省 mystilight） */
  engine?: import('./engine/types').EngineId;
  /** 是否开启双引擎对拍校验 */
  compare?: boolean;
}

export type BaziResult = EightCharJSON;

/** 应用侧私挂在引擎结果上的附加字段（集中声明，替代散落的 as any） */
export interface BaziResultExtras {
  _solarTimeInfo?: Record<string, unknown>;
  _compareReport?: { summary: string; items: unknown[]; a: { name: string }; b: { name: string } };
  engine?: { id?: string; name?: string; school?: string };
  /** 神煞（形状见 shensha-dict：{nian,yue,ri,shi,current}；tyme 引擎由适配层补齐） */
  shensha?: unknown;
}
export type BaziResultX = BaziResult & BaziResultExtras;

// ─── 排盘主函数 ──────────────────────────────────────

export function calculateBazi(input: BaziInput): BaziResult {
  if (!getCurrentEightCharJSON) throw new Error('mystilight-8char 加载失败');

  // 真太阳时预处理下沉至 engine/solar.ts（与 tyme 引擎共用同一实现）
  const { year, month, day, hour, minute, solarTimeInfo } = resolveTrueSolarInput(input);

  const result = getCurrentEightCharJSON({
    year, month, day, hour, minute,
    gender: input.gender,
    sect: input.sect,
  });

  (result as BaziResultX)._solarTimeInfo = solarTimeInfo;

  return result;
}

// ─── 导出 JSON ────────────────────────────────────────

export interface ExportOptions {
  /** 附带当前公历月逐日流日表（默认关；出行择日场景勾选后导出） */
  includeLiuRi?: boolean;
  /** 附带今日十二时辰流时表（默认关；办事择时场景勾选后导出） */
  includeLiuShi?: boolean;
}

/** 太岁「风险等级」为结论型标签（AI 易照抄成断语），导出剔除；relation/details 等事实保留 */
function stripTaiSuiRiskLevel<T>(yh: T): T {
  if (!yh || typeof yh !== 'object') return yh;
  const o = yh as T & { taiSui?: Record<string, unknown> };
  if (!o.taiSui || typeof o.taiSui !== 'object' || !('riskLevel' in o.taiSui)) return yh;
  const taiSui = { ...o.taiSui };
  delete taiSui.riskLevel;
  return { ...o, taiSui };
}

export function buildExportJSON(input: BaziInput, result: BaziResult, opts?: ExportOptions) {
  const ext = result as BaziResultX;
  const dayMasterGan = result.pillars?.dayMasterGan || result.pillars?.day?.gan || '';

  // 流月只展开当前年附近（AI 框架要求详析未来 3-5 年）；全量展开约 1700 条、
  // 独占 13 万字符，与「压缩省 token」目标冲突。其余年份 AI 可按五虎遁自推（见 liuYueNote）。
  const nowYear = new Date().getFullYear();
  const lyFrom = nowYear - 1;
  const lyTo = nowYear + 4;
  const enrichedDayunArr = result.dayunArr?.map((dy) => ({
    ...dy,
    // 日主在大运/流年支的十二长生（如甲行酉运=胎），供 AI 论气数起落
    ...(typeof dy.ganZhi === 'string' && dy.ganZhi.length >= 2 ? { diShi: getDiShi(dayMasterGan, dy.ganZhi[1]) } : {}),
    liunianArr: dy.liunianArr?.map((ln) => {
      const lnGan = typeof ln.ganZhi === 'string' ? ln.ganZhi[0] : '';
      const base = {
        ...ln,
        ...(typeof ln.ganZhi === 'string' && ln.ganZhi.length >= 2 ? { diShi: getDiShi(dayMasterGan, ln.ganZhi[1]) } : {}),
      };
      if (!lnGan || ln.year < lyFrom || ln.year > lyTo) return base;
      return {
        ...base,
        liuYueArr: _getLiuYueForYear(lnGan, dayMasterGan),
      };
    }),
  }));
  const liuYueNote = `流月仅展开 ${lyFrom}~${lyTo} 年；其余年份可按五虎遁由流年干自推（甲己之年丙作首、乙庚之岁戊为头、丙辛必定寻庚起、丁壬壬位顺行流、戊癸甲寅好追求；自正月建寅顺行十二月）`;

  const engineMeta = ext.engine;
  const compareReport = ext._compareReport;

  // ── AI grounding 数据层：查表/规则预检，AI 引用而非回忆 ──
  const kline = buildLifeKline(result);
  const tiaoHou = analyzeTiaoHou(result.pillars);
  const siLing = computeSiLing(
    { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute, utcOffset: input.utcOffset },
    dayMasterGan,
    result.pillars?.month?.zhi,
  );
  const patterns = detectPatterns(result.pillars, {
    judge: kline?.judge,
    wuXingPower: result.wuXingPower as Record<string, number>,
  });
  const shenshaDict = lookupShenShaMeanings(collectShenShaNames(ext.shensha));
  // 格局 + 本格《子平真诠》原文(懒加载库,未就绪时暂缺 classic 字段,同调候原文策略)
  const geJuBase = analyzeGeJu(result.pillars, siLing?.gan);
  const geJuClassic = geJuBase ? getZipingClassic(geJuBase.ge) : null;
  const geJu = geJuBase ? { ...geJuBase, ...(geJuClassic ? { classic: geJuClassic } : {}) } : null;
  const yongShen = buildYongShenSanFa({
    dayGan: dayMasterGan,
    judge: kline?.judge,
    wuXingPower: result.wuXingPower as Record<string, number>,
    tiaoHouGods: tiaoHou?.gods,
    tiaoHouVerdict: tiaoHou?.verdict,
  });
  // 十年规划表（一运一行：十神/长生/喜忌/K线均值/高光低谷/运限格局；复用上方 kline）
  const decadePlan = buildDecadePlan(result, kline);
  // 当前岁运格局扫描（当前大运 × 今年流年；任意大运的扫描见 decadePlan.rows）
  const curDy = result.currentYun?.daYun?.ganZhi;
  const curDyGz = Array.isArray(curDy) ? curDy.join('') : curDy || '';
  const curLn = result.currentYun?.liuNian;
  const curLnGz = curLn?.ganZhi ? (Array.isArray(curLn.ganZhi) ? curLn.ganZhi.join('') : curLn.ganZhi) : '';
  const yunPatternHits = curDyGz
    ? detectYunPatterns({ pillars: result.pillars, judge: kline?.judge, gender: result.gender, dayunGz: curDyGz, liunianGz: curLnGz || undefined })
    : [];

  // 能量多边形不随导出：与 wuXingPower（旺衰加权）双套五行数值口径并存，
  // AI 易混用/择错口径致旺衰误判（雷达图仅页面展示，WuxingRadar 自行计点）。

  // 应期引动预检不随导出：候选年+强度分易被 AI 当「已算定的应期」输出成预言（误报源）；
  // 需要时经 MCP query_yingqi 按需查询（yingqi.ts 模块保留）。

  // 本月流日（可选块）：出行择日用——当前公历月逐日干支/十神/长生；
  // 其他日期 AI 可据 note 里的六十甲子顺推规则自表内任一日推算
  const liuRi = (() => {
    if (!opts?.includeLiuRi || !dayMasterGan) return null;
    const t = new Date();
    const y = t.getFullYear();
    const m = t.getMonth() + 1;
    const days = _getLiuRiForRange(y, m, 1, new Date(y, m, 0).getDate(), dayMasterGan);
    if (!days.length) return null;
    // date = 导出基准日（今日）；文件名后缀与 AI 判断「今天是表中哪一行」均取此值
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    return {
      date: dateStr,
      note: `${y}年${m}月（公历当月）逐日流日，十神以日主 ${dayMasterGan} 论，供出行择日参考；导出当日为 ${dateStr}。表外日期可自表内任一日按六十甲子顺推（日干支逐日进一位，60 日一循环）`,
      dims: ['公历', '农历', '流日', '十神', '日主长生'],
      days: days.map((d) => [
        `${d.solarYear}-${String(d.solarMonth).padStart(2, '0')}-${String(d.solarDay).padStart(2, '0')}`,
        `${d.lunarMonth}月${d.lunarDay}`,
        d.ganZhi,
        d.shiShen,
        getDiShi(dayMasterGan, d.zhi),
      ]),
    };
  })();

  // 今日流时（可选块）：办事择时用——今日十二时辰干支/十神；
  // 任意他日的流时由该日日干按五鼠遁自推（note 附口诀）
  const liuShi = (() => {
    if (!opts?.includeLiuShi || !dayMasterGan) return null;
    const t = new Date();
    const y = t.getFullYear();
    const m = t.getMonth() + 1;
    const d = t.getDate();
    const hours = _getLiuShiForDay(y, m, d, dayMasterGan);
    if (!hours.length) return null;
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const todayGz = _getLiuRiForRange(y, m, d, 1, dayMasterGan)[0]?.ganZhi ?? '';
    const nowShiChen = getShiChenName(t.getHours());
    return {
      date: dateStr,
      ...(todayGz ? { dayGanZhi: todayGz } : {}),
      // 导出时刻所值时辰：文件名后缀取此值，AI 也据此知道「当下」在十二辰的哪一格
      nowShiChen,
      note: `今日（${dateStr}${todayGz ? `，流日${todayGz}` : ''}）十二时辰流时，十神以日主 ${dayMasterGan} 论，供办事择时参考；导出时刻正值${nowShiChen}。表中子时指今日凌晨 0-1 时（早子时段）；今晚 23 时起入次日子时，干支按次日日干另起五鼠遁。任意其他日的流时：由该日日干按五鼠遁起子时（甲己还加甲、乙庚丙作初、丙辛从戊起、丁壬庚子居、戊癸壬子是真途），自子时顺行十二辰`,
      dims: ['时辰', '干支', '十神'],
      hours: hours.map((h) => [h.shiChenName, h.ganZhi, h.shiShen]),
    };
  })();

  return {
    meta: {
      tool: '八字排盘 (react-8char)',
      system: engineMeta?.school || '渊海子平',
      engine: engineMeta?.name,
      sect: input.sect === 2 ? '传统派' : '正统派',
      generatedAt: new Date().toISOString(),
    },
    ...(compareReport
      ? {
          engineCompare: {
            engines: `${compareReport.a.name} × ${compareReport.b.name}`,
            summary: compareReport.summary,
            diffs: compareReport.items,
          },
        }
      : {}),
    input: {
      ...result.input,
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      gender: result.gender,
      sect: result.sect,
      city: input.city || undefined,
      livingPlace: input.livingPlace || undefined,
    },
    ...(() => {
      const notes: string[] = [];
      if (input.city || input.livingPlace) notes.push('请结合出生地与当前居住地的地理、气候因素进行八字分析');
      if (input.userNote) notes.push(input.userNote);
      return notes.length ? { aiNote: notes.join('；') } : {};
    })(),
    solarTimeInfo: ext._solarTimeInfo,
    pillars: result.pillars,
    taiYuan: result.taiYuan,
    taiYuanNaYin: result.taiYuanNaYin,
    taiXi: result.taiXi,
    taiXiNaYin: result.taiXiNaYin,
    mingGong: result.mingGong,
    mingGongNaYin: result.mingGongNaYin,
    shenGong: result.shenGong,
    shenGongNaYin: result.shenGongNaYin,
    wuXingPower: result.wuXingPower,
    yun: result.yun,
    liuYueNote,
    dayunArr: enrichedDayunArr,
    currentYun: result.currentYun,
    ...(liuRi ? { liuRi } : {}),
    ...(liuShi ? { liuShi } : {}),
    ganRelations: result.ganRelations,
    zhiRelations: result.zhiRelations,
    shensha: ext.shensha,
    ...(Object.keys(shenshaDict).length ? { shenshaDict } : {}),
    yuanHaiZiping: stripTaiSuiRiskLevel(result.yuanHaiZiping),
    ...(tiaoHou ? { tiaoHou } : {}),
    ...(siLing ? { siLing } : {}),
    ...(geJu ? { geJu } : {}),
    ...(yongShen ? { yongShen } : {}),
    ...(patterns.length ? { patterns } : {}),
    ...(yunPatternHits.length
      ? {
          yunPatterns: {
            note: '当前岁运格局扫描（确定性规则命中；轻重成败结合原局细辨）',
            dayun: curDyGz,
            ...(curLnGz ? { liunian: curLnGz, year: curLn?.year } : {}),
            hits: yunPatternHits,
          },
        }
      : {}),
    ...(decadePlan
      ? {
          decadePlan: {
            // 导出版不含 K线均值/高光/低谷量化列与扶抑喜忌列：前者同 lifeKline 不导出的理由，
            // 后者为扶抑单口径的逐运结论标签，AI 易照抄跳过自行论证（从格/调候视角下更整体反向）；页面表格仍全量展示
            note: '运限格局为该运与原局的确定性扫描，轻重成败须结合全局细辨',
            dims: ['干支', '虚岁', '公历', '干支十神', '长生', '运限格局'],
            rows: decadePlan.rows.map((r) => [
              r.ganZhi,
              `${r.startAge}~${r.endAge}`,
              `${r.startYear}~${r.endYear}`,
              `${r.ganShen}/${r.zhiShen}`,
              r.diShi,
              r.patterns.map((x) => x.name).join('；'),
            ]),
          },
        }
      : {}),
    xiangFa: buildXiangFaExport(),
    wuYunLiuQi: buildWuYunLiuQiExport(input),
    // 人生K线量化评分不随导出：简化模型的 0-100 分易被 AI 当确定结论锚定，反致误报；
    // K线仅页面展示（kline 在此只用于身强弱 judge 等内部输入）。
  };
}

/** 文件名安全化：剔除路径分隔符与 Windows 保留字符、压缩空白（口径同 react-zwds baseFilename） */
export function sanitizeFileNamePart(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '').trim();
}

/**
 * 导出文件名。基名为「八字排盘_姓名_出生日期_出生时刻」；
 * 勾选了流日/流时可选块时各追加一段后缀（口径同 react-zwds），
 * 后缀值取自 exportData 里的块本身，保证文件名与内容严格同源。
 */
export function generateFileName(input: BaziInput, exportData?: unknown): string {
  const y = String(input.year);
  const m = String(input.month).padStart(2, '0');
  const d = String(input.day).padStart(2, '0');
  const h = String(input.hour).padStart(2, '0');
  const min = String(input.minute).padStart(2, '0');
  // 姓名入文件名（缺省「无名」），多人多盘不再靠日期分辨
  const name = sanitizeFileNamePart(input.name ?? '') || '无名';

  const data = exportData as { liuRi?: { date?: string }; liuShi?: { nowShiChen?: string } } | undefined;
  const liuRi = data?.liuRi?.date ? `_流日${sanitizeFileNamePart(data.liuRi.date)}` : '';
  const liuShi = data?.liuShi?.nowShiChen ? `_流时${sanitizeFileNamePart(data.liuShi.nowShiChen)}` : '';

  return `八字排盘_${name}_${y}-${m}-${d}_${h}-${min}${liuRi}${liuShi}.json`;
}
