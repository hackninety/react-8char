// 节气时间尺度平移（两引擎共用，移植自 react-mcp src/engines/birth/jieqi-scale.ts）。
//
// mystilight-8char（内联 lunar-javascript）与 tyme4ts 的节气表均为北京时（UTC+8），
// 而排盘输入是当地钟表或当地真太阳时。平移量 = 输入尺度领先北京时的分钟数；
// 把节气表平移到输入尺度后，年柱/月柱与起运按「出生瞬间 vs 交节瞬间」比较，日柱/时柱仍按当地读数。
// mystilight 侧由 scripts/mystilight-jieqi-patch.mjs 在构建期读取本文件写入的全局键；
// tyme 侧原型平移见 tyme/jieqi-scale.ts（不在此 import tyme4ts，免得把它拉进首屏 chunk）。
import type { BaziInput } from '../bazi';

/** 与 scripts/mystilight-jieqi-patch.mjs 及 react-mcp 同键：其 vendor 快照若与外层平移叠加，嵌套检查直接报错 */
const SHIFT_KEY = Symbol.for('react-mcp.jieqiShiftDays');
const BEIJING_OFFSET_MINUTES = 480;

type Holder = Record<symbol, number | undefined>;

/** 输入尺度领先北京时的分钟数 = 民用 UTC 偏移 + 已施加的真太阳时偏移 − 480 */
export function solarTermShiftMinutes(clockOffsetMinutes: number, trueSolarOffsetMinutes = 0): number {
  return clockOffsetMinutes + trueSolarOffsetMinutes - BEIJING_OFFSET_MINUTES;
}

/** 按输入实际携带的 utcOffset（缺省 8）与 resolveTrueSolarInput 的校正结果求平移量 */
export function solarTermShiftFor(input: Pick<BaziInput, 'utcOffset'>, solarTimeInfo: Record<string, unknown>): number {
  const trueSolar = solarTimeInfo.applied ? Number(solarTimeInfo.offsetMinutes) : 0;
  return solarTermShiftMinutes(Math.round((input.utcOffset ?? 8) * 60), trueSolar);
}

/**
 * 在平移后的节气尺度上执行一次同步排盘，结束后恢复（浏览器/Node 单线程下安全）。
 * install 挂引擎自身的平移（如 tyme 原型）并返回恢复函数。
 */
export function withSolarTermShift<T>(shiftMinutes: number, run: () => T, install?: (shiftMinutes: number) => () => void): T {
  if (!Number.isInteger(shiftMinutes) || Math.abs(shiftMinutes) > 24 * 60) throw new Error('节气时间尺度偏移无效');
  if (shiftMinutes === 0) return run();
  const holder = globalThis as unknown as Holder;
  if (holder[SHIFT_KEY] !== undefined) throw new Error('节气时间尺度不能嵌套切换');
  holder[SHIFT_KEY] = shiftMinutes / 1440;
  let restore: (() => void) | undefined;
  try {
    restore = install?.(shiftMinutes);
    return run();
  } finally {
    restore?.();
    delete holder[SHIFT_KEY];
  }
}
