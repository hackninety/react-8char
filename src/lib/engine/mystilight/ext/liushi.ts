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
 * 小时（0-23）→ 时辰名。子时跨日（23:00~00:59）故先 +1 再两小时一格。
 */
export function getShiChenName(hour: number): string {
  return SHI_CHEN_NAMES[Math.floor(((hour + 1) % 24) / 2)];
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
      // 子时取当日 0 点（早子时段）而非代表小时 23 点：23 点会触发 lunar-javascript
      // 的换日口径、按次日日干起五鼠遁，导致子时行与丑~亥行分属两套日周期（表内干支不连贯）。
      // 统一取当日时刻后，十二行为同一日干的完整五鼠遁序列；今晚 23 时起属次日子时。
      const h = i === 0 ? 0 : SHI_CHEN_HOURS[i];
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
