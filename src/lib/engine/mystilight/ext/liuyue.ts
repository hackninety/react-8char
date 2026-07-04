// 流月推算（移植自原 fork 的 src/v2/liuyue.mjs）
import { TIAN_GAN, MONTH_ZHI, MONTH_NAMES, WU_HU_DUN } from './constants';
import { getShiShen } from './shishen';

export interface LiuYueItem {
  monthIndex: number;
  monthName: string;
  gan: string;
  zhi: string;
  ganZhi: string;
  shiShen: string;
}

/**
 * 根据年干和日主计算一年十二个流月的干支和十神（五虎遁起月）
 * @param yearGan 流年天干
 * @param dayMasterGan 日主天干
 */
export function getLiuYueForYear(yearGan: string, dayMasterGan: string): LiuYueItem[] {
  const startGanIdx = WU_HU_DUN[yearGan];
  if (startGanIdx === undefined) return [];

  const result: LiuYueItem[] = [];
  for (let i = 0; i < 12; i++) {
    const ganIdx = (startGanIdx + i) % 10;
    const gan = TIAN_GAN[ganIdx];
    const zhi = MONTH_ZHI[i];
    result.push({
      monthIndex: i + 1,
      monthName: MONTH_NAMES[i],
      gan,
      zhi,
      ganZhi: gan + zhi,
      shiShen: getShiShen(dayMasterGan, gan),
    });
  }
  return result;
}
