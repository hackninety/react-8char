// 工具函数（移植自原 fork 的 src/v2/utils.mjs），Lunar/fromBaZi 改为直连上游接入点
import { Lunar, fromBaZi } from '../upstream';

export interface AdjustedTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * 真太阳时经度校正
 * 公式：真太阳时 ≈ 北京时间 + (经度 - 120) × 4 分钟
 * @param longitude 出生地经度
 */
export function applyTrueSolarTime(
  year: number, month: number, day: number,
  hour: number, minute: number, longitude: number,
): AdjustedTime {
  const offsetMinutes = Math.round((longitude - 120) * 4);
  const dt = new Date(year, month - 1, day, hour, minute);
  dt.setMinutes(dt.getMinutes() + offsetMinutes);

  return {
    year: dt.getFullYear(),
    month: dt.getMonth() + 1,
    day: dt.getDate(),
    hour: dt.getHours(),
    minute: dt.getMinutes(),
  };
}

/**
 * 农历转公历
 * @param isLeapMonth 是否闰月
 */
export function lunarToSolar(
  year: number, month: number, day: number,
  hour: number, minute: number, isLeapMonth: boolean,
): AdjustedTime {
  if (!Lunar) throw new Error('Lunar 模块加载失败');
  const lunarMonth = isLeapMonth ? -Math.abs(month) : month;
  const lunar = Lunar.fromYmdHms(year, lunarMonth, day, hour, minute, 0);
  const solar = lunar.getSolar();
  return {
    year: solar.getYear(),
    month: solar.getMonth(),
    day: solar.getDay(),
    hour: solar.getHour(),
    minute: solar.getMinute(),
  };
}

export interface ReverseLookupResult {
  solar: string;
  lunar: string;
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * 八字反查公历日期（最近60年）
 */
export function reverseLookupBazi(yearGZ: string, monthGZ: string, dayGZ: string, timeGZ: string): ReverseLookupResult[] {
  if (!fromBaZi) throw new Error('fromBaZi 方法加载失败');

  const candidates = fromBaZi(yearGZ, monthGZ, dayGZ, timeGZ);
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 60;

  return candidates
    .filter((c) => c.year >= minYear && c.year <= currentYear)
    .map((c) => {
      let lunarStr = '';
      if (Lunar) {
        try {
          const lunar = Lunar.fromDate(new Date(c.year, c.month - 1, c.day, c.hour, c.minute));
          lunarStr = `${lunar.getYearInChinese()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
        } catch { /* ignore */ }
      }
      return {
        solar: c.ymdHms || `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`,
        lunar: lunarStr,
        year: c.year,
        month: c.month,
        day: c.day,
        hour: c.hour,
        minute: c.minute,
      };
    });
}
