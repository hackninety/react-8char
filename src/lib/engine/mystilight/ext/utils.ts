// 工具函数（移植自原 fork 的 src/v2/utils.mjs），Lunar/fromBaZi 改为直连上游接入点
import { Lunar, fromBaZi } from '../upstream';

export interface AdjustedTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/** 年内日序（1~366） */
function dayOfYear(year: number, month: number, day: number): number {
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
}

/**
 * 均时差（Equation of Time，分钟，可为负）。
 * 经典近似式（Whitman/SPA 简式）：B = 2π(N-81)/364，
 * EoT ≈ 9.87·sin(2B) − 7.53·cos(B) − 1.5·sin(B)，精度约 ±0.5 分钟，
 * 满足分钟级排盘需求。全年浮动约 -14 ~ +16 分钟。
 */
export function equationOfTimeMinutes(year: number, month: number, day: number): number {
  const n = dayOfYear(year, month, day);
  const b = (2 * Math.PI * (n - 81)) / 364;
  return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
}

export interface TrueSolarOffset {
  /** 总偏移（分钟，四舍五入）= 地方时差 + 均时差 */
  total: number;
  /** 地方时差部分（分钟，四舍五入）= (经度 − 时区中央经线) × 4 */
  longitudeMinutes: number;
  /** 均时差部分（分钟，保留一位小数） */
  eotMinutes: number;
}

/**
 * 真太阳时总偏移：地方时差 (经度 − 时区中央经线)×4 分 + 均时差 EoT。
 * 单点实现，各引擎共用。
 * @param longitude 出生地经度（东经正、西经负）
 * @param tzMeridian 出生时刻所属时区的中央经线（= UTC偏移×15）；缺省 120（北京时/UTC+8），
 *                   国内命例恒用之；国外命例须按当地时区传入（如日本 135、美东 −75）。
 */
export function getTrueSolarOffset(
  year: number, month: number, day: number, longitude: number, tzMeridian = 120,
): TrueSolarOffset {
  const lngMin = (longitude - tzMeridian) * 4;
  const eot = equationOfTimeMinutes(year, month, day);
  return {
    total: Math.round(lngMin + eot),
    longitudeMinutes: Math.round(lngMin),
    eotMinutes: Math.round(eot * 10) / 10,
  };
}

/**
 * 真太阳时校正
 * 公式：真太阳时 ≈ 当地标准时 + (经度 − 时区中央经线) × 4 分钟 + 均时差(EoT)
 * @param longitude 出生地经度（东经正、西经负）
 * @param tzMeridian 出生时刻所属时区中央经线，缺省 120（北京时）
 */
export function applyTrueSolarTime(
  year: number, month: number, day: number,
  hour: number, minute: number, longitude: number, tzMeridian = 120,
): AdjustedTime {
  const offsetMinutes = getTrueSolarOffset(year, month, day, longitude, tzMeridian).total;
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
