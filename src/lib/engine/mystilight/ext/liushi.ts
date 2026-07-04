// 流时推算（移植自原 fork 的 src/v2/liushi.mjs），Lunar 改为直连上游接入点
import { Lunar } from '../upstream';
import { SHI_CHEN_NAMES, SHI_CHEN_HOURS } from './constants';
import { getShiShen } from './shishen';

export interface LiuShiItem {
  shiChenName: string;
  ganZhi: string;
  gan: string;
  zhi: string;
  shiShen: string;
}

/**
 * 获取某日的十二时辰流时干支和十神
 * @param solarYear 公历年
 * @param solarMonth 公历月
 * @param solarDay 公历日
 * @param dayMasterGan 日主天干
 */
export function getLiuShiForDay(solarYear: number, solarMonth: number, solarDay: number, dayMasterGan: string): LiuShiItem[] {
  if (!Lunar) return [];

  const result: LiuShiItem[] = [];
  for (let i = 0; i < 12; i++) {
    try {
      const h = SHI_CHEN_HOURS[i];
      const lunar = Lunar.fromDate(new Date(solarYear, solarMonth - 1, solarDay, h, 0));
      const gz: string = lunar.getTimeInGanZhi();
      const gan = gz[0];
      result.push({
        shiChenName: SHI_CHEN_NAMES[i],
        ganZhi: gz,
        gan,
        zhi: gz[1],
        shiShen: getShiShen(dayMasterGan, gan),
      });
    } catch { /* skip */ }
  }
  return result;
}
