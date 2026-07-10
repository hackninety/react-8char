// 人生K线：把大运/流年运势量化为 0-100 评分，分「总运 / 事业 / 财运 / 感情 / 健康」五维，
// 各生成 K 线（OHLC）。方法确定性、引擎无关、零新依赖，仅供参考娱乐。
//
// 评分模型（简化扶抑 + 十神类象 + 宫位 + 神煞）：
//   · 总运：以日主强弱定喜忌，大运基调 + 流年干支十神(喜忌加权) + 支冲刑合害
//           + 神煞吉凶 + 岁运并临/天克地冲。
//   · 大运层（十年主题，作用于该运每一年）：大运支冲刑合害本命四支（冲提纲/冲婚姻宫
//     为十年级事件）、大运伏吟日柱、大运支与本命凑齐三合/三会成局；流年层另计岁运支
//     互冲合刑、流年伏吟日柱/年柱、流年干合日干（配偶星合身为姻缘引动）。
//   · 成局/调候/空亡（流年层）：流年补齐三合局/三会方（按成局五行喜忌计分，会方力大于
//     合局）、寒燥命遇火/水运岁的调候得济/受伤（复用 dili 月令暖需表）、流年入日柱旬空
//     （虚耗；被本命/大运支冲则冲空反实不罚）。
//   · 事业：官杀(权位)/印(贵人学业)/食伤(才华) 类象加权；月柱=事业提纲，冲则动荡；
//           贵人/将星神煞助力。
//   · 财运：财才(财星)/食伤(生财) 加权；比劫劫财、劫煞破财扣分；禄神金舆助财。
//   · 感情：按性别取配偶星（男财女官）；日支=婚姻宫，冲则动荡、合则姻缘；
//           桃花红鸾天喜助缘，孤辰寡宿减分。
//   · 健康：以五行平衡（喜忌净值）为底，重罚冲日柱/刑害/羊刃灾煞/岁运并临/天克地冲。
import type { BaziResult } from './bazi';
import { getGanWuXing, getZhiWuXing, ZHI_MAIN_GAN } from './utils';
import { createShenShaLookup } from './engine/tyme/shensha';
import { computeDiLi, WARMTH_NEED, type DiLiResult, type DiLiOffsets } from './dili';
// 直接从引擎扩展层取流月/十神（勿经 bazi.ts 转口，避免循环依赖）
import { getLiuYueForYear } from './engine/mystilight/ext/liuyue';
import { getShiShen } from './engine/mystilight/ext/shishen';

// ─── 基础表 ────────────────────────────────────────────

const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const CHONG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const LIU_HE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const HAI: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const XING: Record<string, string[]> = {
  寅: ['巳', '申'], 巳: ['寅', '申'], 申: ['寅', '巳'],
  丑: ['戌', '未'], 戌: ['丑', '未'], 未: ['丑', '戌'],
  子: ['卯'], 卯: ['子'], 辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],
};
// 天干五合（对称）
const WU_HE: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };

// 三合局 + 三会方（[拼图, 成局五行, 名称, 流年成局力度]；会方之力大于合局，故 9 > 8）
const COMBOS: [string[], string, string, number][] = [
  [['申', '子', '辰'], '水', '申子辰水局', 8],
  [['亥', '卯', '未'], '木', '亥卯未木局', 8],
  [['寅', '午', '戌'], '火', '寅午戌火局', 8],
  [['巳', '酉', '丑'], '金', '巳酉丑金局', 8],
  [['寅', '卯', '辰'], '木', '寅卯辰东方木会', 9],
  [['巳', '午', '未'], '火', '巳午未南方火会', 9],
  [['申', '酉', '戌'], '金', '申酉戌西方金会', 9],
  [['亥', '子', '丑'], '水', '亥子丑北方水会', 9],
];

// 成局五行相对日主的喜忌：取对应十神喜忌权重的均值（正=喜、负=忌）
function elementFavor(el: string, dayWx: string, w: Record<string, number>): number {
  if (el === dayWx) return ((w['比'] ?? 0) + (w['劫'] ?? 0)) / 2;
  if (SHENG[el] === dayWx) return ((w['印'] ?? 0) + (w['枭'] ?? 0)) / 2;
  if (SHENG[dayWx] === el) return ((w['食'] ?? 0) + (w['伤'] ?? 0)) / 2;
  if (KE[dayWx] === el) return ((w['财'] ?? 0) + (w['才'] ?? 0)) / 2;
  return ((w['官'] ?? 0) + (w['杀'] ?? 0)) / 2;
}

// 成局主要波及的分维：官杀局/印局→事业，财局/食伤局/比劫局→财运
function comboDim(el: string, dayWx: string): KlineDim {
  return KE[el] === dayWx || SHENG[el] === dayWx ? 'career' : 'wealth';
}

// added 是否为凑齐 pattern 的最后一块（base 已有其余两支、且 base 自身未含全套——
// 本命自带全套属原局特征，由盘面地支关系呈现，不算运岁事件）
function completesPattern(pattern: string[], base: Set<string>, added: string): boolean {
  return (
    pattern.includes(added) &&
    pattern.every((z) => z === added || base.has(z)) &&
    !pattern.every((z) => base.has(z))
  );
}

const SHORT_FULL: Record<string, string> = {
  比: '比肩', 劫: '劫财', 食: '食神', 伤: '伤官',
  财: '正财', 才: '偏财', 官: '正官', 杀: '七杀', 印: '正印', 枭: '偏印',
};

// 总运喜忌权重（身弱喜印比，身强喜财官食伤）
const WEIGHT_WEAK: Record<string, number> = { 印: 1, 枭: 0.8, 比: 0.8, 劫: 0.5, 食: -0.5, 伤: -0.8, 财: -0.6, 才: -0.6, 官: -0.7, 杀: -1 };
const WEIGHT_STRONG: Record<string, number> = { 印: -0.8, 枭: -0.8, 比: -0.9, 劫: -1, 食: 0.8, 伤: 0.6, 财: 1, 才: 0.8, 官: 0.9, 杀: 0.5 };

// 分维十神类象权重（正负=对该维吉凶，与身强弱无关的「事象」倾向）
const DW_CAREER: Record<string, number> = { 官: 1, 杀: 0.7, 印: 0.7, 枭: 0.4, 食: 0.3, 伤: -0.2, 财: 0.4, 才: 0.3, 比: -0.2, 劫: -0.4 };
const DW_WEALTH: Record<string, number> = { 财: 1, 才: 0.9, 食: 0.7, 伤: 0.6, 官: 0.2, 杀: -0.1, 印: -0.2, 枭: -0.4, 比: -0.6, 劫: -1 };
const DW_LOVE_MALE: Record<string, number> = { 财: 1, 才: 0.5, 食: 0.3, 伤: -0.2, 官: 0.2, 杀: 0.1, 印: -0.2, 枭: -0.3, 比: -0.5, 劫: -0.8 };
const DW_LOVE_FEMALE: Record<string, number> = { 官: 1, 杀: 0.5, 伤: -0.8, 食: -0.3, 财: 0.3, 才: 0.2, 印: 0.2, 枭: -0.2, 比: -0.4, 劫: -0.6 };

// 神煞分类（名称可能带「(日)」等后缀，用 startsWith 匹配）
const SS_NOBLE = ['天乙贵人', '天德贵人', '月德贵人', '文昌贵人', '太极贵人', '国印贵人', '福星贵人', '天厨贵人'];
const SS_ROMANCE: Record<string, number> = { 桃花: 4, 红鸾: 5, 天喜: 4, 红艳: 1 };
const SS_LONELY = ['孤辰', '寡宿'];
const SS_HEALTH_BAD = ['羊刃', '灾煞', '血刃'];

// ─── 类型 ──────────────────────────────────────────────

export type KlineDim = 'total' | 'career' | 'wealth' | 'love' | 'health';
export const KLINE_DIMS: { key: KlineDim; label: string }[] = [
  { key: 'total', label: '总运' },
  { key: 'career', label: '事业' },
  { key: 'wealth', label: '财运' },
  { key: 'love', label: '感情' },
  { key: 'health', label: '健康' },
];
export type StrengthJudge = '身强' | '身弱' | '中和';

interface OHLC { open: number; high: number; low: number; close: number }

export interface KlineYearPoint {
  year: number;
  age: number;
  ganZhi: string;
  dayun: string;
  scores: Record<KlineDim, number>;
  ohlc: Record<KlineDim, OHLC>;
  delta: Record<KlineDim, number>;
  factors: Record<KlineDim, string[]>;
}

export interface KlineDecade {
  ganZhi: string;
  startYear: number;
  endYear: number;
  avg: Record<KlineDim, number>;
}

export interface LifeKlineData {
  judge: StrengthJudge;
  judgeSource: string;
  preferenceNote: string;
  gender: string;
  years: KlineYearPoint[];
  decades: KlineDecade[];
  currentIndex: number;
  /** 地利方位加成（出生地对各维的常数修正） */
  dili: DiLiResult;
}

// ─── 工具 ──────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmt = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`;
const mkRec = <T,>(v: () => T): Record<KlineDim, T> => ({ total: v(), career: v(), wealth: v(), love: v(), health: v() });

// ─── 身强身弱 ──────────────────────────────────────────

function detectStrength(chart: BaziResult): { judge: StrengthJudge; source: string } {
  const sq = (chart as any).yuanHaiZiping?.shenQiang;
  const judgeStr: unknown = sq && typeof sq === 'object' ? sq.judge : undefined;
  if (typeof judgeStr === 'string' && judgeStr) {
    if (judgeStr.includes('强')) return { judge: '身强', source: '渊海子平' };
    if (judgeStr.includes('弱')) return { judge: '身弱', source: '渊海子平' };
    return { judge: '中和', source: '渊海子平' };
  }
  // fallback 简化扶抑：帮扶（同我/生我）为正、克泄耗（克我/我克/我生）为负的净值。
  // 月令本气 ±25 为最大权重，藏干按气级 ±12/6/3，年月时天干 ±7；|净值| ≤ 12 视为中和。
  const p = chart.pillars;
  const dayWx = getGanWuXing(p.day.gan);
  const sign = (wx: string) => (!wx ? 0 : wx === dayWx || SHENG[wx] === dayWx ? 1 : -1);
  let score = 0;
  const monthMain = p.month.hideGanAttr?.[0]?.gan;
  if (monthMain) score += sign(getGanWuXing(monthMain)) * 25;
  const QI_SCORE: Record<string, number> = { 本气: 12, 中气: 6, 余气: 3 };
  for (const key of ['year', 'month', 'day', 'time'] as const) {
    for (const hg of p[key].hideGanAttr ?? []) {
      score += sign(getGanWuXing(hg.gan)) * (QI_SCORE[hg.qiLevel] ?? 0);
    }
  }
  for (const key of ['year', 'month', 'time'] as const) {
    score += sign(getGanWuXing(p[key].gan)) * 7;
  }
  const judge: StrengthJudge = score > 12 ? '身强' : score < -12 ? '身弱' : '中和';
  return { judge, source: '简化扶抑' };
}

function weightsFor(judge: StrengthJudge): { w: Record<string, number>; note: string } {
  if (judge === '身弱') return { w: WEIGHT_WEAK, note: '身弱→喜印比、忌财官食伤' };
  if (judge === '身强') return { w: WEIGHT_STRONG, note: '身强→喜财官食伤、忌印比' };
  const half: Record<string, number> = {};
  for (const [k, v] of Object.entries(WEIGHT_STRONG)) half[k] = v * 0.5;
  return { w: half, note: '中和→略喜食伤财官流通（权重减半）' };
}

// ─── 主计算 ────────────────────────────────────────────

export function buildLifeKline(chart: BaziResult): LifeKlineData | null {
  const dayunArr = (chart as any).dayunArr as {
    startYear: number; ganZhi: string; ganshen?: string; zhishen?: string;
    liunianArr?: { year: number; ganZhi: string; ganshen?: string; zhishen?: string }[];
  }[] | undefined;
  const p = chart.pillars;
  if (!dayunArr?.length || !p?.day) return null;

  const { judge, source } = detectStrength(chart);
  const { w, note } = weightsFor(judge);
  const gender = chart.gender || '男';
  const loveDW = gender === '女' ? DW_LOVE_FEMALE : DW_LOVE_MALE;
  const birthYear = chart.input.year;
  const dayWx = getGanWuXing(p.day.gan);
  const dayZhi = p.day.zhi;
  const monthZhi = p.month.zhi;
  const natalZhis: [string, string][] = [
    [p.year.zhi, '年支'], [monthZhi, '月支'], [dayZhi, '日支'], [p.time.zhi, '时支'],
  ];
  const natalZhiSet = new Set(natalZhis.map(([z]) => z));
  const warmthNeed = WARMTH_NEED[monthZhi] ?? 0;
  const dayKong = p.day.xunKong || '';
  const shenShaOf = createShenShaLookup(
    { year: p.year, month: p.month, day: p.day, time: p.time },
    p.day.xunKong || '',
  );

  // 地利方位（出生地对各维的常数加成）
  const st = (chart as any)._solarTimeInfo;
  const dili = computeDiLi({
    dayWuXing: dayWx,
    judge,
    monthZhi,
    gender,
    latitude: st?.latitude,
    longitude: st?.longitude,
    place: st?.city,
  });
  const diliKey: Record<KlineDim, keyof DiLiOffsets> = { total: 'total', career: 'career', wealth: 'wealth', love: 'love', health: 'health' };

  const dayGZ = p.day.gan + dayZhi;
  const yearGZ = p.year.gan + p.year.zhi;

  const byYear = new Map<number, KlineYearPoint>();
  for (const dy of dayunArr) {
    if (!dy.liunianArr?.length) continue;
    const hasDy = !!dy.ganZhi;
    const dyFav = hasDy ? (w[dy.ganshen ?? ''] ?? 0) + (w[dy.zhishen ?? ''] ?? 0) : 0;

    // ── 大运支 × 本命四支：十年主题级事件（冲提纲/冲婚姻宫为大运级动荡），作用于该运每一年 ──
    const dyZhi = hasDy && dy.ganZhi.length >= 2 ? dy.ganZhi[1] : '';
    const decadeEff: [KlineDim, number, string][] = [];
    if (dyZhi) {
      for (const [zhi, label] of natalZhis) {
        if (CHONG[dyZhi] === zhi) {
          if (label === '月支') decadeEff.push(['total', -4, '大运冲月支(提纲)'], ['career', -5, '大运冲月支(提纲十年动荡)'], ['health', -2, '大运冲月支']);
          else if (label === '日支') decadeEff.push(['total', -4, '大运冲日支'], ['love', -6, '大运冲日支(婚姻宫)'], ['health', -3, '大运冲日支']);
          else decadeEff.push(['total', -2, `大运冲${label}`], ['health', -2, `大运冲${label}`]);
        } else if (XING[dyZhi]?.includes(zhi)) {
          decadeEff.push(['total', -2, `大运刑${label}`], ['health', -3, `大运刑${label}`]);
          if (label === '日支') decadeEff.push(['love', -3, '大运刑婚姻宫']);
          if (label === '月支') decadeEff.push(['career', -2, '大运刑月支']);
        } else if (HAI[dyZhi] === zhi) {
          decadeEff.push(['health', -2, `大运害${label}`]);
          if (label === '日支') decadeEff.push(['love', -2, '大运害婚姻宫']);
        } else if (LIU_HE[dyZhi] === zhi) {
          if (label === '日支') decadeEff.push(['total', 2, '大运合日支'], ['love', 4, '大运合日支(婚姻宫)']);
          else if (label === '月支') decadeEff.push(['total', 2, '大运合月支'], ['career', 3, '大运合月支(机遇)']);
        }
      }
      if (dy.ganZhi === dayGZ) decadeEff.push(['total', -3, '大运伏吟日柱'], ['health', -3, '大运伏吟日柱']);

      // 大运支与本命凑齐三合/三会：十年成局主题（力度略低于流年成局）
      for (const [pat, el, name, mag] of COMBOS) {
        if (!completesPattern(pat, natalZhiSet, dyZhi)) continue;
        const f = elementFavor(el, dayWx, w);
        if (Math.abs(f) < 0.05) continue;
        const tag = `大运会齐${name}(${f > 0 ? '喜' : '忌'})`;
        decadeEff.push(['total', f * (mag - 1), tag], [comboDim(el, dayWx), f * (mag - 1) * 0.6, tag]);
      }
    }

    for (const ln of dy.liunianArr) {
      if (!ln.ganZhi || ln.ganZhi.length < 2) continue;
      const lnGan = ln.ganZhi[0];
      const lnZhi = ln.ganZhi[1];
      const gShen = ln.ganshen ?? '';
      const zShen = ln.zhishen ?? '';

      const S = mkRec(() => 50);
      const F = mkRec<string[]>(() => []);
      const add = (d: KlineDim, v: number, label: string) => {
        if (Math.abs(v) < 0.5) return;
        S[d] += v;
        F[d].push(`${label} ${fmt(v)}`);
      };

      // 十神喜忌净值（供总运/健康）
      const favYear = dyFav * 4 + (w[gShen] ?? 0) * 6 + (w[zShen] ?? 0) * 5;

      // ── 总运：喜忌 ──
      if (hasDy && Math.abs(dyFav) > 0.01) add('total', dyFav * 4, `大运${dy.ganZhi}基调`);
      add('total', (w[gShen] ?? 0) * 6, `流年干${SHORT_FULL[gShen] ?? gShen}`);
      add('total', (w[zShen] ?? 0) * 5, `流年支${SHORT_FULL[zShen] ?? zShen}`);

      // ── 事业 / 财运 / 感情：十神类象 ──
      const applyTenGod = (ss: string, mag: number, src: string) => {
        if (!ss) return;
        const full = SHORT_FULL[ss] ?? ss;
        add('career', (DW_CAREER[ss] ?? 0) * mag, `${src}${full}`);
        add('wealth', (DW_WEALTH[ss] ?? 0) * mag, `${src}${full}`);
        add('love', (loveDW[ss] ?? 0) * mag, `${src}${full}`);
      };
      if (hasDy) { applyTenGod(dy.ganshen ?? '', 3.5, '大运'); applyTenGod(dy.zhishen ?? '', 3, '大运'); }
      applyTenGod(gShen, 6, '流年');
      applyTenGod(zShen, 5, '流年');

      // 分维随整体运势轻微起伏
      for (const d of ['career', 'wealth', 'love'] as const) add(d, favYear * 0.15, '整体运势');

      // ── 求财性质：同样「财旺」，主动得财 vs 被动破财，好坏迥异 ──
      // 判别：身能否任财 + 财生向何方（食伤/正官=主动有对价；七杀攻身/比劫=被动无对价损失）
      {
        const active = new Set([gShen, zShen, hasDy ? dy.ganshen ?? '' : '', hasDy ? dy.zhishen ?? '' : ''].filter(Boolean));
        const anyOf = (...ks: string[]) => ks.some((k) => active.has(k));
        if (anyOf('财', '才')) {
          const hasShiShang = anyOf('食', '伤');
          const hasZhengGuan = active.has('官');
          const hasQiSha = active.has('杀');
          const hasBiJie = anyOf('比', '劫');
          if (hasShiShang) add('wealth', 4, '食伤生财·主动求财得利');
          if (hasQiSha && judge === '身弱') {
            add('wealth', -7, '财生七杀攻身·因财惹祸(被动破财/官非)');
            add('health', -3, '因财招灾·耗身'); add('total', -2, '因财招灾');
          } else if (hasQiSha && judge === '身强') {
            add('wealth', 3, '财滋七杀·身强能任(魄力生财)');
          }
          if (hasZhengGuan) add('wealth', judge === '身弱' ? -3 : 2, judge === '身弱' ? '财生官泄身·力不从心破耗' : '财生正官·正途得利');
          if (hasBiJie) add('wealth', -5, '比劫夺财·破耗被夺(被动)');
          if (judge === '身弱' && !hasShiShang && !hasBiJie && !hasQiSha && !hasZhengGuan) add('wealth', -2, '身弱财旺·富屋贫人担财乏力');
        }
      }

      // ── 支冲刑合害（含宫位）──
      let totalZhiEff = 0;
      for (const [zhi, label] of natalZhis) {
        if (CHONG[lnZhi] === zhi) {
          totalZhiEff += label === '日支' ? -8 : -6;
          add('health', label === '日支' ? -8 : label === '月支' ? -4 : -3, `冲${label}`);
          if (label === '月支') add('career', -7, '冲月支(事业提纲)');
          if (label === '日支') { add('love', -8, '冲日支(婚姻宫)'); add('career', -2, '冲日支'); }
        } else if (XING[lnZhi]?.includes(zhi)) {
          totalZhiEff += -4;
          add('health', -5, `刑${label}`);
          if (label === '月支') add('career', -4, '刑月支');
          if (label === '日支') add('love', -5, '刑婚姻宫');
        } else if (HAI[lnZhi] === zhi) {
          totalZhiEff += -3;
          add('health', -3, `害${label}`);
          if (label === '日支') add('love', -4, '害婚姻宫');
        } else if (LIU_HE[lnZhi] === zhi) {
          totalZhiEff += 3;
          if (label === '月支') add('career', 3, '合月支(事业机遇)');
          if (label === '日支') add('love', 5, '合婚姻宫(姻缘)');
        }
      }
      if (totalZhiEff !== 0) add('total', totalZhiEff, '支作用综合');

      // ── 大运层十年主题效果 ──
      for (const [d, v, label] of decadeEff) add(d, v, label);

      // ── 岁运支互作 ──
      if (dyZhi) {
        if (CHONG[lnZhi] === dyZhi) { add('total', -3, '岁运相冲'); add('health', -2, '岁运相冲'); }
        else if (XING[lnZhi]?.includes(dyZhi)) add('health', -2, '岁运相刑');
        else if (LIU_HE[lnZhi] === dyZhi) add('total', 2, '岁运相合');
      }

      // ── 三合/三会成局：流年支补齐（本命+大运）拼图的最后一块 ──
      {
        const base = dyZhi ? new Set([...natalZhiSet, dyZhi]) : natalZhiSet;
        for (const [pat, el, name, mag] of COMBOS) {
          if (!completesPattern(pat, base, lnZhi)) continue;
          const f = elementFavor(el, dayWx, w);
          if (Math.abs(f) < 0.05) continue;
          const tag = `流年会齐${name}(${f > 0 ? '喜' : '忌'})`;
          add('total', f * mag, tag);
          add(comboDim(el, dayWx), f * mag * 0.6, tag);
          add('health', f * mag * 0.4, tag);
        }
      }

      // ── 调候：寒/燥命遇火/水运岁的得济与受伤（月令暖需复用 dili 表；气候中和之月不计）──
      if (Math.abs(warmthNeed) >= 0.3) {
        const warmthOf = (gz: string, scale: number) => {
          if (!gz || gz.length < 2) return 0;
          const gw = getGanWuXing(gz[0]);
          const zw = getZhiWuXing(gz[1]);
          return scale * ((gw === '火' ? 0.6 : gw === '水' ? -0.6 : 0) + (zw === '火' ? 1 : zw === '水' ? -1 : 0));
        };
        const delivered = warmthOf(hasDy ? dy.ganZhi : '', 0.7) + warmthOf(ln.ganZhi, 1);
        const v = clamp(warmthNeed * delivered * 2, -6, 6);
        if (Math.abs(v) >= 1) {
          const tag = warmthNeed > 0
            ? (delivered > 0 ? '运岁暖济寒局(调候得力)' : '运岁增寒(调候受伤)')
            : (delivered < 0 ? '运岁润济燥局(调候得力)' : '运岁助燥(调候受伤)');
          add('total', v, tag);
          add('health', v * 0.7, tag);
        }
      }

      // ── 空亡：流年支落日柱旬空主虚耗蹉跎；被本命/大运支冲则「冲空反实」不罚 ──
      if (dayKong.includes(lnZhi)) {
        const chongZhi = CHONG[lnZhi];
        if (natalZhiSet.has(chongZhi) || (dyZhi && dyZhi === chongZhi)) {
          add('total', 1, '流年落空亡逢冲(冲空反实)');
        } else {
          add('total', -3, '流年入空亡(虚耗蹉跎)');
          add('health', -1, '流年入空亡');
        }
      }

      // ── 伏吟（干支全同主滞重反复）──
      if (ln.ganZhi === dayGZ) { add('total', -4, '流年伏吟日柱'); add('health', -4, '流年伏吟日柱'); add('love', -2, '流年伏吟日柱'); }
      else if (ln.ganZhi === yearGZ) { add('total', -3, '流年伏吟年柱'); add('health', -3, '流年伏吟年柱'); }

      // ── 流年干合日干（合动日主；配偶星合身为姻缘引动）──
      if (WU_HE[p.day.gan] === lnGan) {
        const spouseShort = gender === '女' ? '官' : '财';
        if (gShen === spouseShort) add('love', 5, '配偶星合日主(姻缘引动)');
        else add('love', 2, '流年干合日干(牵动)');
        add('total', 1, '流年干合日干');
      }

      // ── 神煞 ──
      const ss = shenShaOf({ gan: lnGan, zhi: lnZhi });
      let ssTotal = 0;
      for (const name of ss) {
        if (SS_NOBLE.some((x) => name.startsWith(x))) { ssTotal += 2; add('career', 3, `${name}(贵人)`); }
        if (name.startsWith('将星')) { ssTotal += 1; add('career', 3, name); }
        if (name.startsWith('禄神') || name.startsWith('金舆')) { ssTotal += 1; add('wealth', 3, name); }
        for (const [k, v] of Object.entries(SS_ROMANCE)) if (name.startsWith(k)) add('love', v, name);
        if (SS_LONELY.some((x) => name.startsWith(x))) { add('love', -4, name); }
        if (SS_HEALTH_BAD.some((x) => name.startsWith(x))) { ssTotal -= 2; add('health', -4, name); }
        if (name.startsWith('劫煞')) { ssTotal -= 1; add('wealth', -3, name); }
        // 空亡不再计入神煞综合——已由上方「空亡入运」显式计分（含冲空反实），避免双计
      }
      if (ssTotal !== 0) add('total', clamp(ssTotal, -6, 6), '神煞综合');

      // ── 健康：五行平衡为底 ──
      add('health', favYear * 0.6, '五行平衡');

      // ── 岁运并临 / 天克地冲日柱 ──
      if (hasDy && ln.ganZhi === dy.ganZhi) { add('total', -6, '岁运并临'); add('health', -7, '岁运并临'); }
      if (KE[getGanWuXing(lnGan)] === dayWx && CHONG[lnZhi] === dayZhi) {
        add('total', -8, '天克地冲日柱'); add('health', -10, '天克地冲日柱'); add('career', -3, '天克地冲日柱');
      }

      // ── 地利方位（出生地对各维的常数加成）──
      if (dili.hasLocation) {
        for (const d of KLINE_DIMS) add(d.key, dili.offsets[diliKey[d.key]], `地利·宜${dili.preferDirs}方`);
      }

      const scores = mkRec(() => 0);
      for (const d of KLINE_DIMS) scores[d.key] = clamp(Math.round(S[d.key]), 8, 92);

      byYear.set(ln.year, {
        year: ln.year,
        age: ln.year - birthYear + 1,
        ganZhi: ln.ganZhi,
        dayun: hasDy ? dy.ganZhi : '',
        scores,
        ohlc: mkRec(() => ({ open: 0, high: 0, low: 0, close: 0 })),
        delta: mkRec(() => 0),
        factors: F,
      });
    }
  }

  const years = [...byYear.values()].sort((a, b) => a.year - b.year).slice(0, 100);
  if (years.length < 5) return null;

  // 各维 OHLC 串联
  const prevClose = mkRec(() => 50);
  for (const y of years) {
    for (const { key } of KLINE_DIMS) {
      const close = y.scores[key];
      const open = prevClose[key];
      y.delta[key] = close - open;
      const vol = clamp(3 + y.factors[key].filter((f) => /冲|刑|害|并临|克|伏吟|会齐|空亡/.test(f)).length * 2, 3, 14);
      y.ohlc[key] = {
        open, close,
        high: clamp(Math.max(open, close) + vol * 0.6, 2, 98),
        low: clamp(Math.min(open, close) - vol * 0.6, 2, 98),
      };
      prevClose[key] = close;
    }
  }

  // 大运各维均分
  const decades: KlineDecade[] = [];
  for (const dy of dayunArr) {
    if (!dy.ganZhi || !dy.liunianArr?.length) continue;
    const pts = years.filter((y) => y.dayun === dy.ganZhi && y.year >= dy.startYear);
    if (!pts.length) continue;
    const avg = mkRec(() => 0);
    for (const { key } of KLINE_DIMS) avg[key] = Math.round(pts.reduce((s, y) => s + y.scores[key], 0) / pts.length);
    decades.push({ ganZhi: dy.ganZhi, startYear: pts[0].year, endYear: pts[pts.length - 1].year, avg });
  }

  const nowYear = new Date().getFullYear();
  return {
    judge, judgeSource: source, preferenceNote: note, gender,
    years, decades,
    currentIndex: years.findIndex((y) => y.year === nowYear),
    dili,
  };
}

// ─── 流月K线（单年下钻：12 个月的月度节奏）────────────────
// 模型与年线同源，幅度约为年因素的 60%：流月十神喜忌/类象 + 月支与本命四支冲刑合害
// + 月冲流年(岁破之月)/月冲大运 + 神煞 + 调候 + 空亡。分数围绕锚点（该年开盘值）摆动，
// OHLC 年内串联，表达年内节奏而非绝对运势。

const FULL_SHORT: Record<string, string> = Object.fromEntries(
  Object.entries(SHORT_FULL).map(([s, f]) => [f, s]),
);

export interface KlineMonthPoint {
  monthIndex: number;
  monthName: string;
  ganZhi: string;
  scores: Record<KlineDim, number>;
  ohlc: Record<KlineDim, OHLC>;
  delta: Record<KlineDim, number>;
  factors: Record<KlineDim, string[]>;
}

/**
 * 计算某公历流年的 12 个流月K线。
 * @param anchors 各维锚点（一般传该年的开盘值），缺省 50
 */
export function buildMonthKline(
  chart: BaziResult,
  year: number,
  anchors?: Partial<Record<KlineDim, number>>,
): KlineMonthPoint[] | null {
  const p = chart.pillars;
  if (!p?.day) return null;
  const dayGan = p.day.gan;
  const gender = chart.gender || '男';
  const loveDW = gender === '女' ? DW_LOVE_FEMALE : DW_LOVE_MALE;
  const { judge } = detectStrength(chart);
  const { w } = weightsFor(judge);

  // 定位该年所处大运与流年干支
  const dayunArr = (chart as any).dayunArr as {
    ganZhi: string; liunianArr?: { year: number; ganZhi: string }[];
  }[] | undefined;
  let lnGZ = '';
  let dyGZ = '';
  for (const dy of dayunArr ?? []) {
    const hit = dy.liunianArr?.find((x) => x.year === year);
    if (hit) { lnGZ = hit.ganZhi ?? ''; dyGZ = dy.ganZhi ?? ''; break; }
  }
  if (!lnGZ || lnGZ.length < 2) return null;
  const lnZhi = lnGZ[1];
  const dyZhi = dyGZ.length >= 2 ? dyGZ[1] : '';

  const months = getLiuYueForYear(lnGZ[0], dayGan);
  if (!months.length) return null;

  const natalZhis: [string, string][] = [
    [p.year.zhi, '年支'], [p.month.zhi, '月支'], [p.day.zhi, '日支'], [p.time.zhi, '时支'],
  ];
  const warmthNeed = WARMTH_NEED[p.month.zhi] ?? 0;
  const dayKong = p.day.xunKong || '';
  const shenShaOf = createShenShaLookup(
    { year: p.year, month: p.month, day: p.day, time: p.time },
    dayKong,
  );

  const out: KlineMonthPoint[] = [];
  for (const m of months) {
    const S = mkRec(() => 0);
    const F = mkRec<string[]>(() => []);
    const add = (d: KlineDim, v: number, label: string) => {
      if (Math.abs(v) < 0.5) return;
      S[d] += v;
      F[d].push(`${label} ${fmt(v)}`);
    };

    const gShort = FULL_SHORT[m.shiShen] ?? m.shiShen;
    const zGan = ZHI_MAIN_GAN[m.zhi] ?? '';
    const zShort = zGan ? FULL_SHORT[getShiShen(dayGan, zGan)] ?? '' : '';

    // 十神喜忌（总运）+ 分维类象
    add('total', (w[gShort] ?? 0) * 3.5, `月干${SHORT_FULL[gShort] ?? gShort}`);
    add('total', (w[zShort] ?? 0) * 3, `月支${SHORT_FULL[zShort] ?? zShort}`);
    for (const [ss, mag, src] of [[gShort, 3.5, '月干'], [zShort, 3, '月支']] as const) {
      if (!ss) continue;
      const full = SHORT_FULL[ss] ?? ss;
      add('career', (DW_CAREER[ss] ?? 0) * mag, `${src}${full}`);
      add('wealth', (DW_WEALTH[ss] ?? 0) * mag, `${src}${full}`);
      add('love', (loveDW[ss] ?? 0) * mag, `${src}${full}`);
    }

    // 月支 × 本命四支（约年幅 60%）
    for (const [zhi, label] of natalZhis) {
      if (CHONG[m.zhi] === zhi) {
        if (label === '日支') { add('total', -5, '流月冲日支'); add('love', -5, '流月冲婚姻宫'); add('health', -5, '流月冲日支'); }
        else if (label === '月支') { add('total', -4, '流月冲月支'); add('career', -4, '流月冲月支(提纲)'); add('health', -2, '流月冲月支'); }
        else { add('total', -3, `流月冲${label}`); add('health', -2, `流月冲${label}`); }
      } else if (XING[m.zhi]?.includes(zhi)) {
        add('total', -2, `流月刑${label}`); add('health', -3, `流月刑${label}`);
        if (label === '日支') add('love', -3, '流月刑婚姻宫');
      } else if (HAI[m.zhi] === zhi) {
        add('health', -2, `流月害${label}`);
        if (label === '日支') add('love', -2, '流月害婚姻宫');
      } else if (LIU_HE[m.zhi] === zhi) {
        if (label === '日支') { add('love', 3, '流月合婚姻宫'); add('total', 2, '流月合日支'); }
        else if (label === '月支') { add('career', 2, '流月合月支'); add('total', 2, '流月合月支'); }
      }
    }

    // 月 × 流年 / 大运
    if (CHONG[m.zhi] === lnZhi) { add('total', -2, '月冲流年(岁破之月)'); add('health', -2, '月冲流年'); }
    else if (LIU_HE[m.zhi] === lnZhi) add('total', 1.5, '月合流年');
    if (dyZhi && CHONG[m.zhi] === dyZhi) add('total', -1.5, '月冲大运');

    // 神煞（幅度约年 70%）
    for (const name of shenShaOf({ gan: m.gan, zhi: m.zhi })) {
      if (SS_NOBLE.some((x) => name.startsWith(x))) { add('total', 1.5, `${name}`); add('career', 2, `${name}(贵人)`); }
      if (name.startsWith('将星')) add('career', 2, name);
      if (name.startsWith('禄神') || name.startsWith('金舆')) add('wealth', 2, name);
      for (const [k, v] of Object.entries(SS_ROMANCE)) if (name.startsWith(k)) add('love', v * 0.7, name);
      if (SS_LONELY.some((x) => name.startsWith(x))) add('love', -3, name);
      if (SS_HEALTH_BAD.some((x) => name.startsWith(x))) add('health', -3, name);
      if (name.startsWith('劫煞')) add('wealth', -2, name);
    }

    // 调候（月令气候直接作用）
    if (Math.abs(warmthNeed) >= 0.3) {
      const gw = getGanWuXing(m.gan);
      const zw = getZhiWuXing(m.zhi);
      const delivered = (gw === '火' ? 0.6 : gw === '水' ? -0.6 : 0) + (zw === '火' ? 1 : zw === '水' ? -1 : 0);
      const v = clamp(warmthNeed * delivered * 1.5, -4, 4);
      if (Math.abs(v) >= 1) {
        const tag = warmthNeed > 0 ? (delivered > 0 ? '流月暖济寒局' : '流月增寒') : (delivered < 0 ? '流月润济燥局' : '流月助燥');
        add('total', v, tag);
        add('health', v * 0.7, tag);
      }
    }

    // 空亡
    if (dayKong.includes(m.zhi)) add('total', -2, '流月入空亡');

    out.push({
      monthIndex: m.monthIndex,
      monthName: m.monthName,
      ganZhi: m.ganZhi,
      scores: mkRec(() => 0),
      ohlc: mkRec(() => ({ open: 0, high: 0, low: 0, close: 0 })),
      delta: mkRec(() => 0),
      factors: F,
    });
    // 分数 = 锚点 + 当月净作用（各月独立偏离锚点，表达年内节奏）
    for (const { key } of KLINE_DIMS) {
      out[out.length - 1].scores[key] = clamp(Math.round((anchors?.[key] ?? 50) + S[key]), 5, 95);
    }
  }

  // OHLC 年内串联（首月开盘=锚点）
  const prevClose = mkRec(() => 0);
  for (const { key } of KLINE_DIMS) prevClose[key] = anchors?.[key] ?? 50;
  for (const mp of out) {
    for (const { key } of KLINE_DIMS) {
      const open = prevClose[key];
      const close = mp.scores[key];
      mp.delta[key] = close - open;
      const vol = clamp(2 + mp.factors[key].filter((f) => /冲|刑|害|空亡/.test(f)).length * 2, 2, 10);
      mp.ohlc[key] = {
        open, close,
        high: clamp(Math.max(open, close) + vol * 0.6, 2, 98),
        low: clamp(Math.min(open, close) - vol * 0.6, 2, 98),
      };
      prevClose[key] = close;
    }
  }
  return out;
}
