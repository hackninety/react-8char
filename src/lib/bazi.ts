import {
  getCurrentEightCharJSON,
  getLiuYueForYear as _getLiuYueForYear,
} from './engine/mystilight/ext';
import type { EightCharJSON } from './engine/mystilight/ext';
import { resolveTrueSolarInput } from './engine/solar';
import { buildWuYunLiuQiExport } from './wuyunliuqi';
import { buildLifeKline } from './lifekline';
import { analyzeTiaoHou } from './tiaohou';
import { computeSiLing } from './siling';
import { detectPatterns } from './patterns';
import { analyzeGeJu } from './geju';
import { analyzeYingQi } from './yingqi';
import { buildYongShenSanFa } from './yongshen';
import { getDiShi } from './utils';
import { collectShenShaNames, lookupShenShaMeanings } from './shensha-dict';
import { buildXiangFaExport } from './xiangfa';

// ─── Re-export 引擎扩展 API 供组件使用 ─────────────────
// 原 fork（mystilight-8char-v2）的 v2 能力已内置为应用内扩展层 engine/mystilight/ext，
// 上游改为 npm 直接依赖 mystilight-8char，组件侧 API 保持不变。

export { getShiShen, getLiuYueForYear, getLiuRiForMonth, getLiuShiForDay } from './engine/mystilight/ext';
export { TIAN_GAN, DI_ZHI, JIA_ZI_60 } from './engine/mystilight/ext';
export { lunarToSolar, reverseLookupBazi } from './engine/mystilight/ext';

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

export function buildExportJSON(input: BaziInput, result: BaziResult) {
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
  const geJu = analyzeGeJu(result.pillars, siLing?.gan);
  const yongShen = buildYongShenSanFa({
    dayGan: dayMasterGan,
    judge: kline?.judge,
    wuXingPower: result.wuXingPower as Record<string, number>,
    tiaoHouGods: tiaoHou?.gods,
    tiaoHouVerdict: tiaoHou?.verdict,
  });
  // 应期引动预检：导出仅带近 16 年窗口的紧凑块（任意范围可经 MCP query_yingqi 查询）
  const yingQi = (['婚恋', '事业', '财运'] as const)
    .map((t) => {
      const r = analyzeYingQi(result, t, { from: nowYear - 1, to: nowYear + 15 });
      if (!r?.hits.length) return null;
      return {
        topic: t,
        star: r.starDesc,
        ...(r.palaceDesc ? { palace: r.palaceDesc } : {}),
        dims: ['年', '干支', '强度', '线索'],
        hits: r.hits.slice(0, 8).map((h) => [h.year, h.ganZhi, h.strength, h.reasons.join('；')]),
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

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
    ganRelations: result.ganRelations,
    zhiRelations: result.zhiRelations,
    shensha: ext.shensha,
    ...(Object.keys(shenshaDict).length ? { shenshaDict } : {}),
    yuanHaiZiping: result.yuanHaiZiping,
    ...(tiaoHou ? { tiaoHou } : {}),
    ...(siLing ? { siLing } : {}),
    ...(geJu ? { geJu } : {}),
    ...(yongShen ? { yongShen } : {}),
    ...(patterns.length ? { patterns } : {}),
    ...(yingQi.length
      ? { yingQiNote: '应期为传统引动规则的候选提示，非事件预言；仅展开近 16 年窗口，任意年份范围可经 MCP query_yingqi 查询', yingQi }
      : {}),
    xiangFa: buildXiangFaExport(),
    wuYunLiuQi: buildWuYunLiuQiExport(input),
    // 人生K线五维量化评分（紧凑数组省 token，列见 dims 图例）
    ...(() => {
      const k = kline;
      if (!k || k.years.length < 5) return {};
      return {
        lifeKline: {
          judge: k.judge,
          gender: k.gender,
          note: k.preferenceNote,
          ...(k.dili.hasLocation ? { dili: k.dili.note, diliOffsets: k.dili.offsets } : {}),
          dims: ['年', '干支', '总运', '事业', '财运', '感情', '健康'],
          decadeAvg: k.decades.map((d) => [d.ganZhi, d.startYear, d.avg.total, d.avg.career, d.avg.wealth, d.avg.love, d.avg.health]),
          years: k.years.map((y) => [y.year, y.ganZhi, y.scores.total, y.scores.career, y.scores.wealth, y.scores.love, y.scores.health]),
        },
      };
    })(),
  };
}

export function generateFileName(input: BaziInput): string {
  const y = String(input.year);
  const m = String(input.month).padStart(2, '0');
  const d = String(input.day).padStart(2, '0');
  const h = String(input.hour).padStart(2, '0');
  const min = String(input.minute).padStart(2, '0');
  return `八字排盘_${y}-${m}-${d}_${h}-${min}.json`;
}
