// tyme4ts 引擎的命理神煞（渊海子平常用一套）。
// tyme4ts 只出标准盘面，命理神煞由本模块按经典查法补齐，输出形状与 mystilight 一致
// （{ nian, yue, ri, shi, current } + 「(基准柱)」后缀），供结果页神煞卡片与导出复用。
//
// 后缀含义：(日)=以日干/日支为基准，(年)=以年干/年支为基准，(月)=以月令为基准。
// 已用测试命例逐条与 mystilight 输出对齐核对（天乙/文昌/太极/金舆/亡神/桃花/红鸾/
// 天德/月德/空亡 落柱一致）。
import { TIAN_GAN } from '../mystilight/ext/constants';

type PillarKey = 'year' | 'month' | 'day' | 'time';
interface GZ { gan: string; zhi: string }

export interface TymeShenSha {
  nian: string[];
  yue: string[];
  ri: string[];
  shi: string[];
  current?: { daYun?: string[]; liuNian?: string[] };
}

// 三合局索引：0=申子辰(水) 1=亥卯未(木) 2=寅午戌(火) 3=巳酉丑(金)
const TRINE: Record<string, number> = {
  申: 0, 子: 0, 辰: 0, 亥: 1, 卯: 1, 未: 1, 寅: 2, 午: 2, 戌: 2, 巳: 3, 酉: 3, 丑: 3,
};

// ── 干基（→ 地支）──
const TIAN_YI: Record<string, string> = { 甲: '丑未', 乙: '子申', 丙: '亥酉', 丁: '亥酉', 戊: '丑未', 己: '子申', 庚: '丑未', 辛: '午寅', 壬: '卯巳', 癸: '卯巳' };
const WEN_CHANG: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const TAI_JI: Record<string, string> = { 甲: '子午', 乙: '子午', 丙: '卯酉', 丁: '卯酉', 戊: '辰戌丑未', 己: '辰戌丑未', 庚: '寅亥', 辛: '寅亥', 壬: '巳申', 癸: '巳申' };
const LU_SHEN: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const YANG_REN: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' }; // 阳刃，仅阳干
const JIN_YU: Record<string, string> = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
const HONG_YAN: Record<string, string> = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };

// ── 三合支基（按 TRINE 索引 → 地支）──
const JIANG_XING = ['子', '卯', '午', '酉']; // 将星
const HUA_GAI = ['辰', '未', '戌', '丑']; // 华盖
const YI_MA = ['寅', '巳', '申', '亥']; // 驿马
const TAO_HUA = ['酉', '子', '卯', '午']; // 桃花/咸池
const JIE_SHA = ['巳', '申', '亥', '寅']; // 劫煞
const ZAI_SHA = ['午', '酉', '子', '卯']; // 灾煞
const WANG_SHEN = ['亥', '寅', '巳', '申']; // 亡神

// ── 年支基（→ 地支）──
const HONG_LUAN: Record<string, string> = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' };
const TIAN_XI: Record<string, string> = { 子: '酉', 丑: '申', 寅: '未', 卯: '午', 辰: '巳', 巳: '辰', 午: '卯', 未: '寅', 申: '丑', 酉: '子', 戌: '亥', 亥: '戌' };
const GU_CHEN: Record<string, string> = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
const GUA_SU: Record<string, string> = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' };

// ── 月支基（→ 天干 或 地支）──
const TIAN_DE: Record<string, string> = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
const YUE_DE = ['壬', '甲', '丙', '庚']; // 按 TRINE 索引 → 天干

interface Def { name: string; zhis?: string; gan?: string; exclude?: PillarKey }

/** 由本命四柱构建神煞判定表（含「基准柱自身不计」的三合类自排除） */
function buildDefs(y: GZ, m: GZ, d: GZ, dayXunKong: string): Def[] {
  const defs: Def[] = [];
  const zhi = (name: string, suffix: string, zhis: string | undefined, exclude?: PillarKey) => {
    if (zhis) defs.push({ name: name + suffix, zhis, exclude });
  };
  const gan = (name: string, suffix: string, g: string | undefined) => {
    if (g) defs.push({ name: name + suffix, gan: g });
  };

  // 干基：日干、年干
  zhi('天乙贵人', '(日)', TIAN_YI[d.gan]);
  zhi('天乙贵人', '(年)', TIAN_YI[y.gan]);
  zhi('文昌贵人', '(日)', WEN_CHANG[d.gan]);
  zhi('太极贵人', '(日)', TAI_JI[d.gan]);
  zhi('禄神', '(日)', LU_SHEN[d.gan]);
  zhi('羊刃', '(日)', YANG_REN[d.gan]);
  zhi('金舆', '(日)', JIN_YU[d.gan]);
  zhi('红艳煞', '(日)', HONG_YAN[d.gan]);

  // 三合支基：年支、日支（基准柱本身不计，如年支自为将星不列于年柱）
  for (const [base, suf, exclude] of [[y.zhi, '(年)', 'year'], [d.zhi, '(日)', 'day']] as const) {
    const t = TRINE[base];
    if (t === undefined) continue;
    zhi('将星', suf, JIANG_XING[t], exclude);
    zhi('华盖', suf, HUA_GAI[t], exclude);
    zhi('驿马', suf, YI_MA[t], exclude);
    zhi('桃花', suf, TAO_HUA[t], exclude);
    zhi('劫煞', suf, JIE_SHA[t], exclude);
    zhi('灾煞', suf, ZAI_SHA[t], exclude);
    zhi('亡神', suf, WANG_SHEN[t], exclude);
  }

  // 年支基
  zhi('红鸾', '(年)', HONG_LUAN[y.zhi]);
  zhi('天喜', '(年)', TIAN_XI[y.zhi]);
  zhi('孤辰', '(年)', GU_CHEN[y.zhi]);
  zhi('寡宿', '(年)', GUA_SU[y.zhi]);

  // 月令基：天德（可为干或支）、月德（干）
  const td = TIAN_DE[m.zhi];
  if (td) { if (TIAN_GAN.includes(td)) gan('天德贵人', '', td); else zhi('天德贵人', '', td); }
  const mt = TRINE[m.zhi];
  if (mt !== undefined) gan('月德贵人', '', YUE_DE[mt]);

  // 日柱旬空 → 空亡
  zhi('空亡', '(日)', dayXunKong);

  return defs;
}

function collect(defs: Def[], p: GZ | undefined, key?: PillarKey): string[] {
  if (!p) return [];
  const out: string[] = [];
  for (const def of defs) {
    if (def.exclude && def.exclude === key) continue;
    if (def.zhis && def.zhis.includes(p.zhi)) out.push(def.name);
    else if (def.gan && def.gan === p.gan) out.push(def.name);
  }
  return out;
}

/**
 * 计算 tyme 引擎命盘的命理神煞。
 * @param pillars 本命四柱（gan/zhi）
 * @param dayXunKong 日柱旬空（两地支，如「午未」）
 * @param current 当前大运 / 流年干支（可选，用于填 current 块）
 */
export function computeTymeShenSha(
  pillars: { year: GZ; month: GZ; day: GZ; time: GZ },
  dayXunKong: string,
  current?: { daYun?: GZ; liuNian?: GZ },
): TymeShenSha {
  const defs = buildDefs(pillars.year, pillars.month, pillars.day, dayXunKong);
  const result: TymeShenSha = {
    nian: collect(defs, pillars.year, 'year'),
    yue: collect(defs, pillars.month, 'month'),
    ri: collect(defs, pillars.day, 'day'),
    shi: collect(defs, pillars.time, 'time'),
  };
  if (current && (current.daYun || current.liuNian)) {
    result.current = {};
    if (current.daYun) result.current.daYun = collect(defs, current.daYun);
    if (current.liuNian) result.current.liuNian = collect(defs, current.liuNian);
  }
  return result;
}
