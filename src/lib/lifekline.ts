// 人生K线：把大运/流年运势量化为 0-100 评分，分「总运 / 事业 / 财运 / 感情 / 健康」五维，
// 各生成 K 线（OHLC）。方法确定性、引擎无关、零新依赖，仅供参考娱乐。
//
// 评分模型（简化扶抑 + 十神类象 + 宫位 + 神煞）：
//   · 总运：以日主强弱定喜忌，大运基调 + 流年干支十神(喜忌加权) + 支冲刑合害
//           + 神煞吉凶 + 岁运并临/天克地冲。
//   · 事业：官杀(权位)/印(贵人学业)/食伤(才华) 类象加权；月柱=事业提纲，冲则动荡；
//           贵人/将星神煞助力。
//   · 财运：财才(财星)/食伤(生财) 加权；比劫劫财、劫煞破财扣分；禄神金舆助财。
//   · 感情：按性别取配偶星（男财女官）；日支=婚姻宫，冲则动荡、合则姻缘；
//           桃花红鸾天喜助缘，孤辰寡宿减分。
//   · 健康：以五行平衡（喜忌净值）为底，重罚冲日柱/刑害/羊刃灾煞/岁运并临/天克地冲。
import type { BaziResult } from './bazi';
import { getGanWuXing } from './utils';
import { createShenShaLookup } from './engine/tyme/shensha';

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
  const p = chart.pillars;
  const dayWx = getGanWuXing(p.day.gan);
  let score = 0;
  const monthMain = p.month.hideGanAttr?.[0]?.gan;
  if (monthMain) {
    const wx = getGanWuXing(monthMain);
    if (wx === dayWx || SHENG[wx] === dayWx) score += 25;
  }
  const QI_SCORE: Record<string, number> = { 本气: 12, 中气: 6, 余气: 3 };
  for (const key of ['year', 'month', 'day', 'time'] as const) {
    for (const hg of p[key].hideGanAttr ?? []) {
      if (getGanWuXing(hg.gan) === dayWx) score += QI_SCORE[hg.qiLevel] ?? 0;
    }
  }
  for (const key of ['year', 'month', 'time'] as const) {
    const wx = getGanWuXing(p[key].gan);
    if (wx === dayWx || SHENG[wx] === dayWx) score += 7;
  }
  return { judge: score >= 40 ? '身强' : '身弱', source: '简化扶抑' };
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
  const shenShaOf = createShenShaLookup(
    { year: p.year, month: p.month, day: p.day, time: p.time },
    p.day.xunKong || '',
  );

  const byYear = new Map<number, KlineYearPoint>();
  for (const dy of dayunArr) {
    if (!dy.liunianArr?.length) continue;
    const hasDy = !!dy.ganZhi;
    const dyFav = hasDy ? (w[dy.ganshen ?? ''] ?? 0) + (w[dy.zhishen ?? ''] ?? 0) : 0;

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
        if (name.startsWith('空亡')) ssTotal -= 1;
      }
      if (ssTotal !== 0) add('total', clamp(ssTotal, -6, 6), '神煞综合');

      // ── 健康：五行平衡为底 ──
      add('health', favYear * 0.6, '五行平衡');

      // ── 岁运并临 / 天克地冲日柱 ──
      if (hasDy && ln.ganZhi === dy.ganZhi) { add('total', -6, '岁运并临'); add('health', -7, '岁运并临'); }
      if (KE[getGanWuXing(lnGan)] === dayWx && CHONG[lnZhi] === dayZhi) {
        add('total', -8, '天克地冲日柱'); add('health', -10, '天克地冲日柱'); add('career', -3, '天克地冲日柱');
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
      const vol = clamp(3 + y.factors[key].filter((f) => /冲|刑|害|并临|克/.test(f)).length * 2, 3, 14);
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
  };
}
