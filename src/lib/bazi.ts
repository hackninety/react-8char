import {
  getCurrentEightCharJSON,
  applyTrueSolarTime,
  getLiuYueForYear as _getLiuYueForYear,
} from './engine/mystilight/ext';
import type { EightCharJSON } from './engine/mystilight/ext';
import { getCityByName } from './cities';
import { buildWuYunLiuQiExport } from './wuyunliuqi';

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
  livingPlace?: string;
  userNote?: string;
}

export type BaziResult = EightCharJSON;

// ─── 排盘主函数 ──────────────────────────────────────

export function calculateBazi(input: BaziInput): BaziResult {
  if (!getCurrentEightCharJSON) throw new Error('mystilight-8char 加载失败');

  let { year, month, day, hour, minute } = input;

  let solarTimeApplied = false;
  let solarTimeOffset = 0;
  let lng = input.longitude;
  if (!lng && input.city) {
    const cityInfo = getCityByName(input.city);
    lng = cityInfo?.longitude;
  }
  if (lng !== undefined) {
    solarTimeOffset = Math.round((lng - 120) * 4);
    const adjusted = applyTrueSolarTime(year, month, day, hour, minute, lng);
    year = adjusted.year;
    month = adjusted.month;
    day = adjusted.day;
    hour = adjusted.hour;
    minute = adjusted.minute;
    solarTimeApplied = true;
  }

  const result = getCurrentEightCharJSON({
    year, month, day, hour, minute,
    gender: input.gender,
    sect: input.sect,
  });

  (result as any)._solarTimeInfo = solarTimeApplied
    ? { applied: true, city: input.city, offsetMinutes: solarTimeOffset, adjustedTime: { year, month, day, hour, minute } }
    : { applied: false };

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

  return {
    meta: {
      tool: '八字排盘 (react-8char)',
      system: '渊海子平',
      sect: input.sect === 2 ? '传统派' : '正统派',
      generatedAt: new Date().toISOString(),
    },
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
