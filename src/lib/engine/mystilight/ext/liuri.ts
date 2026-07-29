// 流日推算（移植自原 fork 的 src/v2/liuri.mjs），Lunar 改为直连上游接入点
import { Lunar } from '../upstream';
import { getShiShen } from './shishen';

export interface LiuRiItem {
  solarYear: number;
  solarMonth: number;
  solarDay: number;
  lunarDay: string;
  lunarMonth: string;
  ganZhi: string;
  gan: string;
  zhi: string;
  shiShen: string;
}

/**
 * 根据节气边界获取传统月份的实际公历日期范围。
 * 使用 Lunar.getPrevJie() / getNextJie() 获取当月「节」的起止日期。
 * @param liuNianYear 流年年份
 * @param monthIndex 传统月份索引 (1=正月/寅, 12=腊月/丑)
 */
function getMonthJieBounds(liuNianYear: number, monthIndex: number) {
  const approxSolarMonth = monthIndex <= 11 ? monthIndex + 1 : 1;
  const approxSolarYear = monthIndex <= 11 ? liuNianYear : liuNianYear + 1;
  const midDate = new Date(approxSolarYear, approxSolarMonth - 1, 15);

  try {
    const lunar = Lunar.fromDate(midDate);
    const prevJie = lunar.getPrevJie();
    const nextJie = lunar.getNextJie();
    if (!prevJie || !nextJie) return null;

    // 与原 fork 保持一致：直接读 Solar 内部 _p（该库无公开的 y/m/d getter 快捷径）
    const s1 = prevJie.getSolar()._p;
    const s2 = nextJie.getSolar()._p;
    return {
      startYear: s1.year as number, startMonth: s1.month as number, startDay: s1.day as number,
      endYear: s2.year as number, endMonth: s2.month as number, endDay: s2.day as number,
    };
  } catch {
    return null;
  }
}

/**
 * 获取自某公历日起连续 N 天的流日干支和十神（跨月无碍）。
 * 供导出「近期流日流时」窗口用：出行择日/办事择时场景勾选后随盘导出。
 */
export function getLiuRiForRange(
  solarYear: number, solarMonth: number, solarDay: number,
  days: number, dayMasterGan: string,
): LiuRiItem[] {
  if (!Lunar) return [];
  const result: LiuRiItem[] = [];
  const cur = new Date(solarYear, solarMonth - 1, solarDay);
  for (let i = 0; i < days; i++) {
    try {
      const lunar = Lunar.fromDate(cur);
      const gz: string = lunar.getDayInGanZhi();
      result.push({
        solarYear: cur.getFullYear(),
        solarMonth: cur.getMonth() + 1,
        solarDay: cur.getDate(),
        lunarDay: lunar.getDayInChinese(),
        lunarMonth: lunar.getMonthInChinese(),
        ganZhi: gz,
        gan: gz[0],
        zhi: gz[1],
        shiShen: getShiShen(dayMasterGan, gz[0]),
      });
    } catch { /* skip */ }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}

/**
 * 获取某流年某月的每日流日干支和十神（基于节气边界）
 * @param liuNianYear 流年年份
 * @param monthIndex 传统月份索引 (1-12)
 * @param dayMasterGan 日主天干
 */
export function getLiuRiForMonth(liuNianYear: number, monthIndex: number, dayMasterGan: string): LiuRiItem[] {
  if (!Lunar) return [];

  const bounds = getMonthJieBounds(liuNianYear, monthIndex);
  if (!bounds) return [];

  const startDate = new Date(bounds.startYear, bounds.startMonth - 1, bounds.startDay);
  const endDate = new Date(bounds.endYear, bounds.endMonth - 1, bounds.endDay);
  const result: LiuRiItem[] = [];

  const cur = new Date(startDate);
  while (cur < endDate) {
    try {
      const y = cur.getFullYear();
      const m = cur.getMonth() + 1;
      const d = cur.getDate();
      const lunar = Lunar.fromDate(cur);
      const gz: string = lunar.getDayInGanZhi();
      const gan = gz[0];
      result.push({
        solarYear: y,
        solarMonth: m,
        solarDay: d,
        lunarDay: lunar.getDayInChinese(),
        lunarMonth: lunar.getMonthInChinese(),
        ganZhi: gz,
        gan,
        zhi: gz[1],
        shiShen: getShiShen(dayMasterGan, gan),
      });
    } catch { /* skip */ }
    cur.setDate(cur.getDate() + 1);
  }
  return result;
}
