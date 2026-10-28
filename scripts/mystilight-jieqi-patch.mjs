// mystilight-8char 1.0.0（MIT，内联 lunar-javascript）构建/测试期补丁，移植自 react-mcp 同名脚本。
// 该包按北京时儒略日为每个 Lunar 建节气表；排盘输入却是当地钟表（或真太阳时）。
// src/lib/engine/jieqi-scale.ts 在单次排盘期间写入平移量，补丁据此把节气表平移到输入所用尺度，
// 使年柱/月柱与起运按「出生瞬间 vs 交节瞬间」比较。日柱/时柱、农历月与闰月不受影响；平移为 0 时与上游一致。
// dev（optimizeDeps 预构建）、vite build、Vitest 与 mcp:build 均经此文件打补丁，勿绕过。
import { readFileSync } from 'node:fs';

/** 与 jieqi-scale.ts 及 react-mcp 同键：其 vendor 快照若与外层平移叠加，嵌套检查会直接报错而非静默双重平移 */
export const JIEQI_SHIFT_KEY = 'react-mcp.jieqiShiftDays';
export const OBSERVATION_TIME_KEY = 'react-mcp.baziObservationTime';
export const MYSTILIGHT_FILE = /mystilight-8char[\\/]index\.js$/;

const TARGET = 'o["jieQi"][key] = Solar.fromJulianDay(julianDays[i]);';
const REPLACEMENT = `o["jieQi"][key] = Solar.fromJulianDay(julianDays[i] + (globalThis[Symbol.for(${JSON.stringify(JIEQI_SHIFT_KEY)})] || 0));`;
const OBSERVATION_TARGET = 'const lunarCur = Solar.fromYmd(curY, curM, curD).getLunar();';
// 当前运限有自己的钟表/时区；不能继承出生的经度、夏令时或真太阳时偏移。
// MCP 显式提供观测时刻；前端沿用浏览器当前时刻及该时刻的民用偏移。
const OBSERVATION_REPLACEMENT = `const lunarCur = (() => {
  const observation = globalThis[Symbol.for(${JSON.stringify(OBSERVATION_TIME_KEY)})] || {
    year: curY, month: curM, day: curD, hour: now.getHours(), minute: now.getMinutes(),
    utcOffsetMinutes: -now.getTimezoneOffset()
  };
  const key = Symbol.for(${JSON.stringify(JIEQI_SHIFT_KEY)});
  const previous = globalThis[key];
  try {
    globalThis[key] = (observation.utcOffsetMinutes - 480) / 1440;
    return Solar.fromYmdHms(observation.year, observation.month, observation.day, observation.hour, observation.minute, 0).getLunar();
  } finally {
    if (previous === undefined) delete globalThis[key]; else globalThis[key] = previous;
  }
})();`;
const MONTH_TARGET = 'const monthGanZhi = sect === 2 ? lunarCur.getMonthInGanZhiExact() : lunarCur.getMonthInGanZhi();';
const MONTH_REPLACEMENT = 'const monthGanZhi = lunarCur.getMonthInGanZhiExact();';

export function patchMystilight(code) {
  for (const [target, replacement] of [[TARGET, REPLACEMENT], [OBSERVATION_TARGET, OBSERVATION_REPLACEMENT], [MONTH_TARGET, MONTH_REPLACEMENT]]) {
    const count = code.split(target).length - 1;
    if (count !== 1) throw new Error(`mystilight-8char solar-term patch expected exactly one target, found ${count}; review the upstream bundle before upgrading`);
    code = code.replace(target, replacement);
  }
  return code;
}

/** esbuild 插件：供 Vite 依赖预构建（optimizeDeps）与 mcp:build 打包使用 */
export function mystilightEsbuildPlugin() {
  return {
    name: 'mystilight-jieqi-patch',
    setup(build) {
      build.onLoad({ filter: MYSTILIGHT_FILE }, (args) => ({ contents: patchMystilight(readFileSync(args.path, 'utf8')), loader: 'js' }));
    },
  };
}

/** Vite/Vitest 插件：vite build 与 Vitest（需 server.deps.inline 该包）在 transform 阶段打同一补丁 */
export function mystilightVitePlugin() {
  return {
    name: 'mystilight-jieqi-patch',
    enforce: 'pre',
    transform(code, id) {
      return MYSTILIGHT_FILE.test(id.split('?')[0]) ? { code: patchMystilight(code), map: null } : undefined;
    },
  };
}
