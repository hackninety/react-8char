// mystilight 引擎扩展层（原 fork mystilight-8char-v2 的 v2 能力，现内置为应用内「插件」）。
// 上游 npm 包只提供 getCurrentEightCharJSON / fromBaZi / Lunar，
// 十神、流月/流日/流时、真太阳时、农历转换、八字反查均由本层补齐。

// 上游 API 透传
export { getCurrentEightCharJSON, fromBaZi, Lunar } from '../upstream';
export type { EightCharJSON, GetCurrentEightCharJSONOpts, SolarCandidate, Pillar } from '../upstream';

// 常量
export {
  TIAN_GAN, DI_ZHI, JIA_ZI_60,
  MONTH_ZHI, MONTH_NAMES, WU_HU_DUN,
  GAN_WX_IDX, GAN_YY,
  SHI_CHEN_NAMES, SHI_CHEN_HOURS,
} from './constants';

// 十神
export { getShiShen } from './shishen';

// 流月 / 流日 / 流时
export { getLiuYueForYear } from './liuyue';
export type { LiuYueItem } from './liuyue';
export { getLiuRiForMonth } from './liuri';
export type { LiuRiItem } from './liuri';
export { getLiuShiForDay } from './liushi';
export type { LiuShiItem } from './liushi';

// 工具：真太阳时（经度差+均时差）/ 农历转公历 / 八字反查
export { applyTrueSolarTime, getTrueSolarOffset, equationOfTimeMinutes, lunarToSolar, reverseLookupBazi } from './utils';
export type { AdjustedTime, TrueSolarOffset, ReverseLookupResult } from './utils';
