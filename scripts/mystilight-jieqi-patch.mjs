// mystilight-8char 1.0.0（MIT，内联 lunar-javascript）构建/测试期补丁，移植自 react-mcp 同名脚本。
// 该包按北京时儒略日为每个 Lunar 建节气表；排盘输入却是当地钟表（或真太阳时）。
// src/lib/engine/jieqi-scale.ts 在单次排盘期间写入平移量，补丁据此把节气表平移到输入所用尺度，
// 使年柱/月柱与起运按「出生瞬间 vs 交节瞬间」比较。日柱/时柱、农历月与闰月不受影响；平移为 0 时与上游一致。
// dev（optimizeDeps 预构建）、vite build、Vitest 与 mcp:build 均经此文件打补丁，勿绕过。
import { readFileSync } from 'node:fs';

/** 与 jieqi-scale.ts 及 react-mcp 同键：其 vendor 快照若与外层平移叠加，嵌套检查会直接报错而非静默双重平移 */
export const JIEQI_SHIFT_KEY = 'react-mcp.jieqiShiftDays';
export const MYSTILIGHT_FILE = /mystilight-8char[\\/]index\.js$/;

const TARGET = 'o["jieQi"][key] = Solar.fromJulianDay(julianDays[i]);';
const REPLACEMENT = `o["jieQi"][key] = Solar.fromJulianDay(julianDays[i] + (globalThis[Symbol.for(${JSON.stringify(JIEQI_SHIFT_KEY)})] || 0));`;

export function patchMystilight(code) {
  const count = code.split(TARGET).length - 1;
  if (count !== 1) throw new Error(`mystilight-8char solar-term patch expected exactly one target, found ${count}; review the upstream bundle before upgrading`);
  return code.replace(TARGET, REPLACEMENT);
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
