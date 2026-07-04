// 干支基础常量（移植自原 fork mystilight-8char-v2 的 src/v2/constants.mjs）

// 天干
export const TIAN_GAN: readonly string[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

// 地支
export const DI_ZHI: readonly string[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

// 月支（正月寅起）
export const MONTH_ZHI: readonly string[] = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];

// 月份名（正月~腊月）
export const MONTH_NAMES: readonly string[] = ['正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月'];

// 五虎遁: 年干 -> 正月天干的起始索引
// 甲己 -> 丙(2), 乙庚 -> 戊(4), 丙辛 -> 庚(6), 丁壬 -> 壬(8), 戊癸 -> 甲(0)
export const WU_HU_DUN: Readonly<Record<string, number | undefined>> = {
  '甲': 2, '己': 2,
  '乙': 4, '庚': 4,
  '丙': 6, '辛': 6,
  '丁': 8, '壬': 8,
  '戊': 0, '癸': 0,
};

// 十神辅助映射：天干 -> 五行索引
export const GAN_WX_IDX: Readonly<Record<string, number | undefined>> = {
  '甲': 0, '乙': 0, '丙': 1, '丁': 1, '戊': 2, '己': 2, '庚': 3, '辛': 3, '壬': 4, '癸': 4,
};

// 十神辅助映射：天干 -> 阴阳 (1=阳, 0=阴)
export const GAN_YY: Readonly<Record<string, number | undefined>> = {
  '甲': 1, '乙': 0, '丙': 1, '丁': 0, '戊': 1, '己': 0, '庚': 1, '辛': 0, '壬': 1, '癸': 0,
};

// 时辰名
export const SHI_CHEN_NAMES: readonly string[] = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];

// 时辰对应的代表小时
export const SHI_CHEN_HOURS: readonly number[] = [23, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];

// 六十甲子
export const JIA_ZI_60: readonly string[] = Array.from(
  { length: 60 },
  (_, i) => TIAN_GAN[i % 10] + DI_ZHI[i % 12],
);
