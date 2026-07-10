// 干支关系基础表:五行生克、支冲合刑害、天干五合、三合三会、墓库、阳刃。
// 原散落于 lifekline/patterns/yingqi/yongshen 各持一份,下沉共享(岁运格局扫描 yunpatterns 亦复用)。
// 表为传统定式,勿改;流派分歧处(土库)在注释注明。

/** 五行相生:木→火→土→金→水→木 */
export const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克:木→土→水→火→金→木 */
export const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

/** 地支六冲(对称) */
export const CHONG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
/** 地支六合(对称) */
export const LIU_HE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
/** 地支六害(对称) */
export const HAI: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
/** 地支相刑(寅巳申/丑戌未三刑、子卯相刑、辰午酉亥自刑) */
export const XING: Record<string, string[]> = {
  寅: ['巳', '申'], 巳: ['寅', '申'], 申: ['寅', '巳'],
  丑: ['戌', '未'], 戌: ['丑', '未'], 未: ['丑', '戌'],
  子: ['卯'], 卯: ['子'], 辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],
};
/** 天干五合(对称) */
export const WU_HE: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };

/** 三合局 + 三会方([拼图, 成局五行, 名称, 流年成局力度];会方之力大于合局,故 9 > 8) */
export const COMBOS: [string[], string, string, number][] = [
  [['申', '子', '辰'], '水', '申子辰水局', 8],
  [['亥', '卯', '未'], '木', '亥卯未木局', 8],
  [['寅', '午', '戌'], '火', '寅午戌火局', 8],
  [['巳', '酉', '丑'], '金', '巳酉丑金局', 8],
  [['寅', '卯', '辰'], '木', '寅卯辰东方木会', 9],
  [['巳', '午', '未'], '火', '巳午未南方火会', 9],
  [['申', '酉', '戌'], '金', '申酉戌西方金会', 9],
  [['亥', '子', '丑'], '水', '亥子丑北方水会', 9],
];

/** added 是否为凑齐 pattern 的最后一块(base 已有其余两支、且 base 自身未含全套——原局自带全套属盘面特征,不算运岁事件) */
export function completesPattern(pattern: string[], base: Set<string>, added: string): boolean {
  return (
    pattern.includes(added) &&
    pattern.every((z) => z === added || base.has(z)) &&
    !pattern.every((z) => base.has(z))
  );
}

/** 五行墓库(土库有火土/水土同宫之流派分歧,跳过不用) */
export const KU_ZHI: Record<string, string> = { 木: '未', 火: '戌', 金: '丑', 水: '辰' };

/** 阳刃支(仅五阳干有刃) */
export const YANG_REN: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
