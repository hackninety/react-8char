// mystilight-8char（npm 上游）统一接入点。
//
// 注意：该包 1.0.0 的 package.json main 指向不存在的 dist/index.js，
// 故此处直连根入口文件 index.js（自足打包产物，零外部依赖）。
// 该文件是 ESM 转译成 CJS 的产物，真实 API 挂在 module.exports.default 上，
// 用 `(raw as any).default ?? raw` 同时兼容「上游修复 main/导出形状」前后两种情况。
import * as raw from 'mystilight-8char/index.js';
import type { EightCharJSON, GetCurrentEightCharJSONOpts, SolarCandidate } from 'mystilight-8char';

interface UpstreamApi {
  getCurrentEightCharJSON: (opts: GetCurrentEightCharJSONOpts) => EightCharJSON;
  fromBaZi: (
    yearGZ: string, monthGZ: string, dayGZ: string, timeGZ: string,
    sect?: 1 | 2, baseYear?: number,
  ) => SolarCandidate[];
  /** 上游内联的 lunar-javascript Lunar 类（未类型化） */
  Lunar: any;
}

const api = ((raw as unknown as { default?: UpstreamApi }).default ?? raw) as unknown as UpstreamApi;

export const getCurrentEightCharJSON = api.getCurrentEightCharJSON;
export const fromBaZi = api.fromBaZi;
export const Lunar = api.Lunar;

export type { EightCharJSON, GetCurrentEightCharJSONOpts, SolarCandidate };
export type { Pillar, PillarsAll, HideGanAttr, CurrentYun, DayunArrItem, YunInfo, WuXing, QiLevel } from 'mystilight-8char';
