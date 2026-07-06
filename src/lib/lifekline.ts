// 人生K线：把大运/流年运势量化为 0-100 评分，生成 K 线（OHLC）数据。
//
// 评分模型（确定性、引擎无关，简化扶抑法，仅供参考）：
//   1) 定喜忌：优先用引擎的渊海子平身强判定（shenQiang.judge），缺失时（如 tyme 引擎）
//      按「月令得令 + 地支通根 + 天干印比」简化计算；身弱喜印比、身强喜财官食伤，
//      中和则略喜食伤财官（取流通之意，权重减半）。
//   2) 逐年计分：50 为基准，叠加——
//      · 大运基调（大运干支十神 × 喜忌权重 × 8）
//      · 流年十神（天干 ×6、地支本气 ×5）
//      · 流年支与原局四支的冲(-6，冲日支再-2)/刑(-4)/害(-3)/六合(+3)
//      · 流年神煞（吉+2/凶-2，合计封顶 ±6）
//      · 岁运并临 -6、天克地冲日柱 -8
//      结果收敛到 [8, 92]。
//   3) K 线：open=上年 close，close=当年评分，high/low 由当年动荡度（冲刑害/并临等）撑开。
import type { BaziResult } from './bazi';
import { getGanWuXing } from './utils';
import { createShenShaLookup } from './engine/tyme/shensha';

// ─── 基础表 ────────────────────────────────────────────

const SHENG: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// 地支六冲 / 六合 / 六害
const CHONG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const LIU_HE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const HAI: Record<string, string> = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
// 相刑（寅巳申、丑戌未、子卯、辰午酉亥自刑），按「任一方向成对即算」处理
const XING: Record<string, string[]> = {
  寅: ['巳', '申'], 巳: ['寅', '申'], 申: ['寅', '巳'],
  丑: ['戌', '未'], 戌: ['丑', '未'], 未: ['丑', '戌'],
  子: ['卯'], 卯: ['子'],
  辰: ['辰'], 午: ['午'], 酉: ['酉'], 亥: ['亥'],
};

// 十神简称 → 全称（dayunArr 里的 ganshen/zhishen 为简称）
const SHORT_FULL: Record<string, string> = {
  比: '比肩', 劫: '劫财', 食: '食神', 伤: '伤官',
  财: '正财', 才: '偏财', 官: '正官', 杀: '七杀', 印: '正印', 枭: '偏印',
};

// 喜忌权重（按十神简称）
const WEIGHT_WEAK: Record<string, number> = { 印: 1, 枭: 0.8, 比: 0.8, 劫: 0.5, 食: -0.5, 伤: -0.8, 财: -0.6, 才: -0.6, 官: -0.7, 杀: -1 };
const WEIGHT_STRONG: Record<string, number> = { 印: -0.8, 枭: -0.8, 比: -0.9, 劫: -1, 食: 0.8, 伤: 0.6, 财: 1, 才: 0.8, 官: 0.9, 杀: 0.5 };

// 参与计分的神煞（按名称前缀匹配，名称可能带「(日)」等后缀）
const SS_GOOD = ['天乙贵人', '天德贵人', '月德贵人', '文昌贵人', '太极贵人', '禄神', '金舆', '将星', '天喜', '红鸾', '福星贵人', '天厨贵人'];
const SS_BAD = ['羊刃', '亡神', '劫煞', '灾煞', '空亡', '孤辰', '寡宿', '红艳煞', '元辰', '勾绞煞'];

// ─── 类型 ──────────────────────────────────────────────

export type StrengthJudge = '身强' | '身弱' | '中和';

export interface KlineYearPoint {
  year: number;
  /** 虚岁 */
  age: number;
  ganZhi: string;
  /** 所属大运干支（起运前为空） */
  dayun: string;
  open: number;
  close: number;
  high: number;
  low: number;
  /** 当年评分（=close） */
  score: number;
  /** 相对上一年涨跌 */
  delta: number;
  /** 计分因素明细（中文，可直接展示/喂 AI） */
  factors: string[];
}

export interface KlineDecade {
  ganZhi: string;
  startYear: number;
  endYear: number;
  avg: number;
}

export interface LifeKlineData {
  judge: StrengthJudge;
  /** 判定来源：渊海子平 / 简化扶抑 */
  judgeSource: string;
  /** 喜忌一句话（供展示与导出） */
  preferenceNote: string;
  years: KlineYearPoint[];
  decades: KlineDecade[];
  /** 当前公历年在 years 中的下标（不在范围内为 -1） */
  currentIndex: number;
}

// ─── 身强身弱 ──────────────────────────────────────────

function detectStrength(chart: BaziResult): { judge: StrengthJudge; source: string } {
  const sq = (chart as any).yuanHaiZiping?.shenQiang;
  const judgeStr: unknown = sq && typeof sq === 'object' ? sq.judge : undefined;
  if (typeof judgeStr === 'string' && judgeStr) {
    if (judgeStr.includes('强')) return { judge: '身强', source: '渊海子平' };
    if (judgeStr.includes('弱')) return { judge: '身弱', source: '渊海子平' };
    return { judge: '中和', source: '渊海子平' };
  }
  // 简化扶抑：月令得令 +25；通根（藏干同我：本气12/中气6/余气3）；他柱天干印比 +7
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
    for (const h of p[key].hideGanAttr ?? []) {
      if (getGanWuXing(h.gan) === dayWx) score += QI_SCORE[h.qiLevel] ?? 0;
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const fmt = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n)}`;

export function buildLifeKline(chart: BaziResult): LifeKlineData | null {
  const dayunArr = (chart as any).dayunArr as {
    startYear: number; ganZhi: string; ganshen?: string; zhishen?: string;
    liunianArr?: { year: number; ganZhi: string; ganshen?: string; zhishen?: string }[];
  }[] | undefined;
  const p = chart.pillars;
  if (!dayunArr?.length || !p?.day) return null;

  const { judge, source } = detectStrength(chart);
  const { w, note } = weightsFor(judge);
  const birthYear = chart.input.year;
  const dayWx = getGanWuXing(p.day.gan);
  const natalZhis: [string, string][] = [
    [p.year.zhi, '年支'], [p.month.zhi, '月支'], [p.day.zhi, '日支'], [p.time.zhi, '时支'],
  ];
  const shenShaOf = createShenShaLookup(
    { year: p.year, month: p.month, day: p.day, time: p.time },
    p.day.xunKong || '',
  );

  // 逐年评分（后出现的大运覆盖起运前占位段的重叠年份）
  const byYear = new Map<number, KlineYearPoint>();
  for (const dy of dayunArr) {
    if (!dy.liunianArr?.length) continue;
    const hasDy = !!dy.ganZhi;
    // 大运基调
    let dyContrib = 0;
    if (hasDy) {
      dyContrib = ((w[dy.ganshen ?? ''] ?? 0) + (w[dy.zhishen ?? ''] ?? 0)) * 8;
    }
    for (const ln of dy.liunianArr) {
      if (!ln.ganZhi || ln.ganZhi.length < 2) continue;
      const lnGan = ln.ganZhi[0];
      const lnZhi = ln.ganZhi[1];
      const factors: string[] = [];
      let score = 50;
      let turbulence = 0;

      if (hasDy && dyContrib !== 0) {
        score += dyContrib;
        factors.push(`大运${dy.ganZhi}基调 ${fmt(dyContrib)}`);
      }

      // 流年十神
      const gw = (w[ln.ganshen ?? ''] ?? 0) * 6;
      if (gw !== 0) {
        score += gw;
        factors.push(`流年天干${SHORT_FULL[ln.ganshen ?? ''] ?? ln.ganshen} ${fmt(gw)}`);
      }
      const zw = (w[ln.zhishen ?? ''] ?? 0) * 5;
      if (zw !== 0) {
        score += zw;
        factors.push(`流年地支${SHORT_FULL[ln.zhishen ?? ''] ?? ln.zhishen} ${fmt(zw)}`);
      }

      // 支冲刑合害
      for (const [zhi, label] of natalZhis) {
        if (CHONG[lnZhi] === zhi) {
          const v = label === '日支' ? -8 : -6;
          score += v; turbulence += 2.5;
          factors.push(`流年支冲${label}${label === '日支' ? '（婚姻宫）' : ''} ${fmt(v)}`);
        } else if (XING[lnZhi]?.includes(zhi)) {
          score += -4; turbulence += 1.8;
          factors.push(`流年支刑${label} -4`);
        } else if (HAI[lnZhi] === zhi) {
          score += -3; turbulence += 1.2;
          factors.push(`流年支害${label} -3`);
        } else if (LIU_HE[lnZhi] === zhi) {
          score += 3;
          factors.push(`流年支合${label} +3`);
        }
      }

      // 神煞（封顶 ±6）
      const ss = shenShaOf({ gan: lnGan, zhi: lnZhi });
      let ssSum = 0;
      const ssNames: string[] = [];
      for (const name of ss) {
        if (SS_GOOD.some((g) => name.startsWith(g))) { ssSum += 2; ssNames.push(name); }
        else if (SS_BAD.some((b) => name.startsWith(b))) { ssSum -= 2; ssNames.push(name); }
      }
      ssSum = clamp(ssSum, -6, 6);
      if (ssSum !== 0) {
        score += ssSum; turbulence += Math.abs(ssSum) * 0.4;
        factors.push(`神煞（${ssNames.slice(0, 4).join('、')}${ssNames.length > 4 ? '…' : ''}）${fmt(ssSum)}`);
      }

      // 岁运并临 / 天克地冲日柱
      if (hasDy && ln.ganZhi === dy.ganZhi) {
        score += -6; turbulence += 5;
        factors.push('岁运并临 -6');
      }
      if (KE[getGanWuXing(lnGan)] === dayWx && CHONG[lnZhi] === p.day.zhi) {
        score += -8; turbulence += 5;
        factors.push('天克地冲日柱 -8');
      }

      score = clamp(Math.round(score), 8, 92);
      byYear.set(ln.year, {
        year: ln.year,
        age: ln.year - birthYear + 1,
        ganZhi: ln.ganZhi,
        dayun: hasDy ? dy.ganZhi : '',
        open: 0, close: score, high: 0, low: 0,
        score,
        delta: 0,
        factors,
      });
    }
  }

  const years = [...byYear.values()].sort((a, b) => a.year - b.year).slice(0, 100);
  if (!years.length) return null;

  // OHLC 串联
  let prevClose = 50;
  for (const y of years) {
    y.open = prevClose;
    y.delta = y.close - y.open;
    const vol = clamp(3 + (y.factors.filter((f) => /冲|刑|害|并临/.test(f)).length) * 2, 3, 14);
    y.high = clamp(Math.max(y.open, y.close) + vol * 0.6, 2, 98);
    y.low = clamp(Math.min(y.open, y.close) - vol * 0.6, 2, 98);
    prevClose = y.close;
  }

  // 大运均分（只统计真实大运段）
  const decades: KlineDecade[] = [];
  for (const dy of dayunArr) {
    if (!dy.ganZhi || !dy.liunianArr?.length) continue;
    const pts = years.filter((y) => y.dayun === dy.ganZhi && y.year >= dy.startYear);
    if (!pts.length) continue;
    decades.push({
      ganZhi: dy.ganZhi,
      startYear: pts[0].year,
      endYear: pts[pts.length - 1].year,
      avg: Math.round(pts.reduce((s, y) => s + y.score, 0) / pts.length),
    });
  }

  const nowYear = new Date().getFullYear();
  return {
    judge,
    judgeSource: source,
    preferenceNote: note,
    years,
    decades,
    currentIndex: years.findIndex((y) => y.year === nowYear),
  };
}
