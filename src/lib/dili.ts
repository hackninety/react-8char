// 地利方位：以「喜用神方位 + 调候寒热」评估出生地对命的补益，分维（总/事业/财运/感情/健康）
// 给出常数加成。确定性、仅供参考——古法「八字即命」，方位属地利微调（雪中送炭/锦上添花），非改命。
//
// 原理：五行配方位气候（木东/火南/土中/金西/水北；南暖北寒东温西凉）。
//   · 由日主强弱推各五行喜忌（身弱喜印比、身强喜财官食伤），调候再补：寒命喜火、燥热命喜水。
//   · 由出生地纬度定寒热（取绝对值，南北半球对赤道对称）、经度定东西（东亚范围内适用），得该地「助旺」的五行。
//   · 地助旺之五行若为喜用→有利，若为忌→不利。分维取各维主星五行：
//     事业看官杀方、财运看财方、感情看配偶星方（男财女官）、健康/总运看喜用综合方。

type WuXing = '木' | '火' | '土' | '金' | '水';
const SHENG: Record<WuXing, WuXing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE: Record<WuXing, WuXing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const DIR: Record<WuXing, string> = { 木: '东', 火: '南', 土: '中', 金: '西', 水: '北' };

type Rel = '比' | '印' | '食伤' | '财' | '官杀';
function relOf(day: WuXing, e: WuXing): Rel {
  if (e === day) return '比';
  if (SHENG[e] === day) return '印';
  if (SHENG[day] === e) return '食伤';
  if (KE[day] === e) return '财';
  return '官杀'; // KE[e] === day
}
const FAV_WEAK: Record<Rel, number> = { 比: 0.8, 印: 1, 食伤: -0.6, 财: -0.7, 官杀: -0.9 };
const FAV_STRONG: Record<Rel, number> = { 比: -0.9, 印: -0.7, 食伤: 0.7, 财: 1, 官杀: 0.6 };

// 月支 → 调候暖需（+需火暖 / −需水润）。lifekline 的调候维度亦复用此表。
export const WARMTH_NEED: Record<string, number> = {
  子: 1, 丑: 0.8, 亥: 0.8, 戌: 0.3, 酉: 0.2, 申: 0.2, 寅: 0.1, 卯: 0, 辰: -0.2, 巳: -0.8, 午: -1, 未: -0.8,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ELEMENTS: WuXing[] = ['木', '火', '土', '金', '水'];

export interface DiLiOffsets { total: number; career: number; wealth: number; love: number; health: number }
export interface DiLiResult {
  hasLocation: boolean;
  /** 一句话地利结论（供展示/导出） */
  note: string;
  /** 宜方位简述，如「南、东」 */
  preferDirs: string;
  offsets: DiLiOffsets;
}

export interface DiLiInput {
  dayWuXing: string;
  judge: '身强' | '身弱' | '中和';
  monthZhi: string;
  gender: string;
  latitude?: number;
  longitude?: number;
  /** 出生地名（仅用于文案） */
  place?: string;
}

const ZERO: DiLiOffsets = { total: 0, career: 0, wealth: 0, love: 0, health: 0 };

export function computeDiLi(input: DiLiInput): DiLiResult {
  const day = input.dayWuXing as WuXing;
  if (!DIR[day] || input.latitude === undefined || input.longitude === undefined) {
    return { hasLocation: false, note: '未提供出生地纬度，地利未计入', preferDirs: '', offsets: { ...ZERO } };
  }

  // ── 各五行喜忌（扶抑 + 调候）──
  const favBase = input.judge === '身弱' ? FAV_WEAK : input.judge === '身强' ? FAV_STRONG : null;
  const warmthNeed = WARMTH_NEED[input.monthZhi] ?? 0;
  const elementFav: Record<WuXing, number> = {} as Record<WuXing, number>;
  for (const e of ELEMENTS) {
    const base = favBase ? favBase[relOf(day, e)] : FAV_STRONG[relOf(day, e)] * 0.5;
    let f = base;
    if (e === '火') f += warmthNeed * 0.6;
    if (e === '水') f -= warmthNeed * 0.6;
    elementFav[e] = clamp(f, -1.2, 1.2);
  }

  // ── 出生地助旺的五行（纬度定寒热、经度定东西）──
  // 寒热取纬度绝对值：南北半球对赤道对称，悉尼(-33.9°)与北纬 33.9° 同为温带，
  // 不取绝对值会把南半球中高纬误判为酷热。
  const southern = input.latitude < 0;
  const warmthProvided = clamp((33 - Math.abs(input.latitude)) / 13, -1, 1); // 低纬→暖旺火，高纬→寒旺水
  // 东西湿燥（东润旺木/西燥旺金）是中国大陆内的地理梯度概念，
  // 远离东亚（约 70°E~140°E 之外）不适用，置零只保留寒热轴。
  const eastProvided = input.longitude >= 70 && input.longitude <= 140
    ? clamp((input.longitude - 108) / 12, -1, 1)
    : 0;
  const locBoost: Record<WuXing, number> = {
    火: warmthProvided, 水: -warmthProvided, 木: eastProvided, 金: -eastProvided, 土: 0,
  };

  // ── 分维主星五行 ──
  const officer = ELEMENTS.find((e) => KE[e] === day)!; // 官杀=克日主者
  const wealth = KE[day]; // 财=日主所克
  const spouse = input.gender === '女' ? officer : wealth; // 男财女官

  const dim = (e: WuXing, mag: number) => clamp(Math.round(locBoost[e] * elementFav[e] * mag), -6, 6);
  const agg = ELEMENTS.reduce((s, e) => s + locBoost[e] * elementFav[e], 0);
  const aggScore = clamp(Math.round(agg * 2.5), -6, 6);

  const offsets: DiLiOffsets = {
    total: aggScore,
    health: aggScore,
    career: dim(officer, 4),
    wealth: dim(wealth, 4),
    love: dim(spouse, 4),
  };

  // ── 文案 ──
  const nsDir = warmthProvided > 0.33 ? '偏南(暖)' : warmthProvided < -0.33 ? '偏北(寒)' : '南北适中';
  const ewDir = eastProvided > 0.4 ? '偏东' : eastProvided < -0.4 ? '偏西' : '';
  const preferEls = ELEMENTS.filter((e) => elementFav[e] > 0.3);
  const preferDirs = [...new Set(preferEls.map((e) => DIR[e]).filter((d) => d !== '中'))].join('、') || '中和';
  const conclusion = aggScore > 1 ? '地利有助' : aggScore < -1 ? '地利欠佳（宜后天补方位/颜色/行业）' : '地利平平';
  const place = input.place ? `出生地${input.place}` : '出生地';
  const southNote = southern ? '；南半球出生：季节与月令倒置，凡涉月令调候之论请谨慎参考' : '';
  const note = `${place}${nsDir}${ewDir}；本命喜用偏${preferEls.map((e) => e).join('') || '中和'}（宜${preferDirs}方）→ ${conclusion}${southNote}`;

  return { hasLocation: true, note, preferDirs, offsets };
}
