// @ts-ignore mystilight-8char-v2 .mjs entry
import {
  getCurrentEightCharJSON,
  applyTrueSolarTime,
  getLiuYueForYear as _getLiuYueForYear,
} from 'mystilight-8char-v2';
import type { EightCharJSON } from 'mystilight-8char-v2';
import { getCityByName } from './cities';

// ─── Re-export v2 API 供组件使用 ──────────────────────

// @ts-ignore
export { getShiShen, getLiuYueForYear, getLiuRiForMonth, getLiuShiForDay } from 'mystilight-8char-v2';
// @ts-ignore
export { TIAN_GAN, DI_ZHI, JIA_ZI_60 } from 'mystilight-8char-v2';
// @ts-ignore
export { lunarToSolar, reverseLookupBazi } from 'mystilight-8char-v2';

// Re-export types from v2.d.ts
export type { LiuYueItem, LiuRiItem, LiuShiItem, ReverseLookupResult } from 'mystilight-8char-v2';

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
}

export type BaziResult = EightCharJSON;

// ─── 排盘主函数 ──────────────────────────────────────

export function calculateBazi(input: BaziInput): BaziResult {
  if (!getCurrentEightCharJSON) throw new Error('mystilight-8char-v2 加载失败');

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
      version: '2.0.0',
      generatedAt: new Date().toISOString(),
    },
    input: {
      ...result.input,
      gender: result.gender,
      sect: result.sect,
      city: input.city || undefined,
    },
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
