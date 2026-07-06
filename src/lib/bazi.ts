import {
  getCurrentEightCharJSON,
  applyTrueSolarTime,
  getTrueSolarOffset,
  getLiuYueForYear as _getLiuYueForYear,
} from './engine/mystilight/ext';
import type { EightCharJSON } from './engine/mystilight/ext';
import { getCityByName } from './cities';
import { buildWuYunLiuQiExport } from './wuyunliuqi';
import { buildLifeKline } from './lifekline';

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

// ─── 排盘主函数 ──────────────────────────────────────

export function calculateBazi(input: BaziInput): BaziResult {
  if (!getCurrentEightCharJSON) throw new Error('mystilight-8char 加载失败');

  let { year, month, day, hour, minute } = input;

  let solarTimeInfo: Record<string, unknown> = { applied: false };
  let lng = input.longitude;
  if (lng === undefined && input.city) {
    const cityInfo = getCityByName(input.city);
    lng = cityInfo?.longitude;
  }
  if (lng !== undefined) {
    // 真太阳时 = 当地标准时 + 地方时差 + 均时差（单点实现见 ext/utils getTrueSolarOffset）。
    // 时区中央经线 = UTC偏移×15；缺省北京时（UTC+8→120°），国外命例由 utcOffset 指定。
    const utcOffset = input.utcOffset ?? 8;
    const tzMeridian = utcOffset * 15;
    const off = getTrueSolarOffset(year, month, day, lng, tzMeridian);
    const adjusted = applyTrueSolarTime(year, month, day, hour, minute, lng, tzMeridian);
    year = adjusted.year;
    month = adjusted.month;
    day = adjusted.day;
    hour = adjusted.hour;
    minute = adjusted.minute;
    solarTimeInfo = {
      applied: true,
      city: input.city,
      utcOffset,
      offsetMinutes: off.total,
      longitudeMinutes: off.longitudeMinutes,
      eotMinutes: off.eotMinutes,
      adjustedTime: { year, month, day, hour, minute },
    };
  }

  const result = getCurrentEightCharJSON({
    year, month, day, hour, minute,
    gender: input.gender,
    sect: input.sect,
  });

  (result as any)._solarTimeInfo = solarTimeInfo;

  return result;
}

// ─── 导出 JSON ────────────────────────────────────────

export function buildExportJSON(input: BaziInput, result: BaziResult) {
  const dayMasterGan = result.pillars?.dayMasterGan || result.pillars?.day?.gan || '';

  const enrichedDayunArr = result.dayunArr?.map((dy: any) => ({
    ...dy,
    liunianArr: dy.liunianArr?.map((ln: any) => {
      const lnGan = typeof ln.ganZhi === 'string' ? ln.ganZhi[0] : '';
      return {
        ...ln,
        liuYueArr: lnGan ? _getLiuYueForYear(lnGan, dayMasterGan) : [],
      };
    }),
  }));

  const engineMeta = (result as any).engine as { name?: string; school?: string } | undefined;
  const compareReport = (result as any)._compareReport as
    | { summary: string; items: unknown[]; a: { name: string }; b: { name: string } }
    | undefined;

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
    solarTimeInfo: (result as any)._solarTimeInfo,
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
    dayunArr: enrichedDayunArr,
    currentYun: result.currentYun,
    ganRelations: result.ganRelations,
    zhiRelations: result.zhiRelations,
    shensha: (result as any).shensha,
    yuanHaiZiping: result.yuanHaiZiping,
    wuYunLiuQi: buildWuYunLiuQiExport(input),
    // 人生K线量化评分（紧凑数组省 token：[年, 干支, 评分]）
    ...(() => {
      const k = buildLifeKline(result);
      if (!k || k.years.length < 5) return {};
      return {
        lifeKline: {
          judge: k.judge,
          note: k.preferenceNote,
          decadeAvg: k.decades.map((d) => [d.ganZhi, d.startYear, d.avg]),
          years: k.years.map((y) => [y.year, y.ganZhi, y.score]),
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
