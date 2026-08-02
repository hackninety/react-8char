// 流时推算（移植自原 fork 的 src/v2/liushi.mjs），Lunar 改为直连上游接入点
import { Lunar } from '../upstream';
import { SHI_CHEN_NAMES } from './constants';
import { getShiShen } from './shishen';

export interface LiuShiItem {
  shiChenName: string;
  /** 钟表时段（如 03:00~05:00），择时直接可用 */
  range: string;
  ganZhi: string;
  gan: string;
  zhi: string;
  shiShen: string;
}

// 十三时辰（口径同 react-zwds TIME_OPTIONS）：早子时与晚子时分列。
// [时辰名, 代表小时, 钟表时段]；代表小时取该段内任一时刻即可确定干支。
const SHI_CHEN_13: readonly [string, number, string][] = [
  ['早子时', 0, '00:00~01:00'],
  ['丑时', 1, '01:00~03:00'],
  ['寅时', 3, '03:00~05:00'],
  ['卯时', 5, '05:00~07:00'],
  ['辰时', 7, '07:00~09:00'],
  ['巳时', 9, '09:00~11:00'],
  ['午时', 11, '11:00~13:00'],
  ['未时', 13, '13:00~15:00'],
  ['申时', 15, '15:00~17:00'],
  ['酉时', 17, '17:00~19:00'],
  ['戌时', 19, '19:00~21:00'],
  ['亥时', 21, '21:00~23:00'],
  ['晚子时', 23, '23:00~00:00'],
];

/**
 * 小时（0-23）→ 时辰名（十三时辰口径，同 react-zwds timeIndexFromClock）：
 * 0 点段为早子时、23 点段为晚子时，其余两小时一格。
 */
export function getShiChenName(hour: number): string {
  if (hour >= 23) return '晚子时';
  if (hour < 1) return '早子时';
  return SHI_CHEN_NAMES[Math.floor((hour + 1) / 2)];
}

/**
 * 获取某日的十三时辰流时干支和十神（早/晚子时分列，对齐 react-zwds）。
 * 早子时按当日日干起五鼠遁；晚子时 23 点起入次日周期，干支即次日日干之子时
 * （= 早子时干进两位；早晚子时之争只影响日柱归属，时干支两派同此）。
 * lunar-javascript 按精确时刻换日，两行干支无需自算。
 */
export function getLiuShiForDay(solarYear: number, solarMonth: number, solarDay: number, dayMasterGan: string): LiuShiItem[] {
  if (!Lunar) return [];

  const result: LiuShiItem[] = [];
  for (const [shiChenName, h, range] of SHI_CHEN_13) {
    try {
      const lunar = Lunar.fromDate(new Date(solarYear, solarMonth - 1, solarDay, h, 0));
      const gz: string = lunar.getTimeInGanZhi();
      const gan = gz[0];
      result.push({
        shiChenName,
        range,
        ganZhi: gz,
        gan,
        zhi: gz[1],
        shiShen: getShiShen(dayMasterGan, gan),
      });
    } catch { /* skip */ }
  }
  return result;
}
