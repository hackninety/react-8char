// 真太阳时预处理（两引擎共用）。
// 原 bazi.ts calculateBazi 与 engine/tyme/adapter.ts resolveInput 各有一份逐行相同的逻辑，
// 下沉于此消除漂移风险——修改口径（如均时差算法）只需改一处。
import { applyTrueSolarTime, getTrueSolarOffset } from './mystilight/ext/utils';
import { getCityByName } from '../cities';
import type { BaziInput } from '../bazi';

export interface ResolvedSolarInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 导出用校正信息（未校正时 { applied: false }） */
  solarTimeInfo: Record<string, unknown>;
}

/**
 * 真太阳时 = 当地标准时 + 地方时差 + 均时差（单点实现见 mystilight/ext/utils）。
 * 时区中央经线 = UTC 偏移 × 15；缺省北京时（UTC+8 → 120°E），国外命例由 utcOffset 指定。
 * 经度优先取 input.longitude，缺省时按 city 查表；两者皆无则不校正。
 */
export function resolveTrueSolarInput(input: BaziInput): ResolvedSolarInput {
  let { year, month, day, hour, minute } = input;
  let solarTimeInfo: Record<string, unknown> = { applied: false };
  let lng = input.longitude;
  if (lng === undefined && input.city) lng = getCityByName(input.city)?.longitude;
  if (lng !== undefined) {
    const utcOffset = input.utcOffset ?? 8;
    const tzMeridian = utcOffset * 15;
    const off = getTrueSolarOffset(year, month, day, lng, tzMeridian);
    const adjusted = applyTrueSolarTime(year, month, day, hour, minute, lng, tzMeridian);
    ({ year, month, day, hour, minute } = adjusted);
    solarTimeInfo = {
      applied: true,
      city: input.city,
      longitude: lng,
      latitude: input.latitude,
      utcOffset,
      offsetMinutes: off.total,
      longitudeMinutes: off.longitudeMinutes,
      eotMinutes: off.eotMinutes,
      adjustedTime: adjusted,
    };
  }
  return { year, month, day, hour, minute, solarTimeInfo };
}
