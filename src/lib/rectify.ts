// 生时校正助手（定盘，参照 react-zwds rectify）：出生时辰不详时，同日十三个时辰
// （早子~晚子）并排起盘，给出关键差异 + 按「性格特征勾选」与「已发生大事年份反查（K线）」打匹配分。
//
// 口径：校时按标准时辰排盘（不作真太阳时校正——时辰不详即无可靠钟表时刻）；
// 早晚子时分派（sect）沿用当前输入。十三盘中年/月柱恒同，差异全在时柱与
// 晚子时换日（正统派日柱进一日，整盘日主随变——跨度最大，重点比对），
// 故特征判定聚焦时柱十神/时支作用/羊刃桃花驿马等随时辰而变的部分。
// K线仅作大事年份反查的内部输入（页面功能，不随导出）。
import { calculateBazi } from './bazi';
import type { BaziInput, BaziResult } from './bazi';
import { buildLifeKline } from './lifekline';
import { CHONG, HAI, XING, YANG_REN } from './ganzhi';

export interface HourCandidate {
  /** 0~12（早子~晚子） */
  index: number;
  label: string;
  /** 钟表时段 */
  range: string;
  /** 代表时刻（选定后回填排盘用） */
  hour: number;
  minute: number;
  /** 四柱文本（年 月 日 时） */
  pillarsText: string;
  dayGz: string;
  timeGz: string;
  /** 时干十神 / 时支本气十神 */
  tGanShen: string;
  tZhiShen: string;
  /** 晚子时相对其余候选换了日柱（正统派）；用于高亮跨日差异 */
  dayChanged: boolean;
  /** 起运（yyyy-mm-dd，顺/逆） */
  qiYun: string;
  mingGong: string;
  chart: BaziResult;
}

export type LifeEvent = { year: number; kind: 'good' | 'turbulent' };

/** 十三时辰代表时刻（早/晚子时分列，钟点口径同流时表/react-zwds） */
export const HOUR_REPRESENTATIVES: readonly { label: string; range: string; hour: number; minute: number }[] = [
  { label: '早子时', range: '00:00~01:00', hour: 0, minute: 30 },
  { label: '丑时', range: '01:00~03:00', hour: 2, minute: 0 },
  { label: '寅时', range: '03:00~05:00', hour: 4, minute: 0 },
  { label: '卯时', range: '05:00~07:00', hour: 6, minute: 0 },
  { label: '辰时', range: '07:00~09:00', hour: 8, minute: 0 },
  { label: '巳时', range: '09:00~11:00', hour: 10, minute: 0 },
  { label: '午时', range: '11:00~13:00', hour: 12, minute: 0 },
  { label: '未时', range: '13:00~15:00', hour: 14, minute: 0 },
  { label: '申时', range: '15:00~17:00', hour: 16, minute: 0 },
  { label: '酉时', range: '17:00~19:00', hour: 18, minute: 0 },
  { label: '戌时', range: '19:00~21:00', hour: 20, minute: 0 },
  { label: '亥时', range: '21:00~23:00', hour: 22, minute: 0 },
  { label: '晚子时', range: '23:00~00:00', hour: 23, minute: 30 },
];

// 三合局取桃花/驿马（通行口径：按日支所属三合局）
const TAO_HUA: Record<string, string> = { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子' };
const YI_MA: Record<string, string> = { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳' };

const xingEach = (a: string, b: string) => (XING[a] ?? []).includes(b);

/** 引擎身强弱结论（渊海子平），特征判定辅助用 */
function judgeOf(c: BaziResult): string {
  const sq = (c as { yuanHaiZiping?: { shenQiang?: { judge?: string } } }).yuanHaiZiping?.shenQiang;
  return sq?.judge ?? '';
}

export interface Trait {
  id: string;
  label: string;
  test: (c: HourCandidate) => boolean;
}

/**
 * 十个可勾选的性格/经历特征。十三盘年月日柱基本恒同，判定只用随时辰而变的信息
 * （时柱十神、时支与日支作用、羊刃/桃花/驿马），按通行类象撰写，仅供缩小范围。
 */
export const TRAITS: Trait[] = [
  {
    id: 'action',
    label: '行动派·果断·闲不住',
    test: (c) => c.tGanShen === '七杀' || c.tZhiShen === '七杀' || c.timeGz[1] === YANG_REN[c.dayGz[0]],
  },
  {
    id: 'steady',
    label: '性子稳·求安稳·有耐性',
    test: (c) => ['正官', '食神'].includes(c.tGanShen) || ['正官', '食神'].includes(c.tZhiShen),
  },
  {
    id: 'talk',
    label: '口才好·点子多·才艺外露',
    test: (c) => ['伤官', '食神'].includes(c.tGanShen) || ['伤官', '食神'].includes(c.tZhiShen),
  },
  {
    id: 'sensitive',
    label: '心思细腻·敏感多虑',
    test: (c) => c.tGanShen === '偏印' || c.tZhiShen === '偏印' || HAI[c.timeGz[1]] === c.dayGz[1],
  },
  {
    id: 'lead',
    label: '主见强·不易服管',
    test: (c) =>
      ['比肩', '劫财'].includes(c.tGanShen) ||
      ['比肩', '劫财'].includes(c.tZhiShen) ||
      c.timeGz[1] === YANG_REN[c.dayGz[0]],
  },
  {
    id: 'study',
    label: '书卷气·爱学习钻研',
    test: (c) => ['正印', '偏印'].includes(c.tGanShen) || ['正印', '偏印'].includes(c.tZhiShen),
  },
  {
    id: 'money',
    label: '理财务实·钱财有算计',
    test: (c) => ['正财', '偏财'].includes(c.tGanShen) || ['正财', '偏财'].includes(c.tZhiShen),
  },
  {
    id: 'charm',
    label: '人缘桃花旺·异性缘好',
    test: (c) => c.timeGz[1] === TAO_HUA[c.dayGz[1]],
  },
  {
    id: 'travel',
    label: '常外出奔波/早年离家',
    test: (c) => c.timeGz[1] === YI_MA[c.dayGz[1]] || CHONG[c.timeGz[1]] === c.dayGz[1],
  },
  {
    id: 'health',
    label: '幼时体弱或有明显伤病',
    test: (c) =>
      CHONG[c.timeGz[1]] === c.dayGz[1] ||
      xingEach(c.timeGz[1], c.dayGz[1]) ||
      (judgeOf(c.chart) === '身弱' && (c.tGanShen === '七杀' || c.tGanShen === '偏印')),
  },
];

/**
 * 同日十三时辰并排起盘。剔除定位字段（不作真太阳时校正）；
 * gender/sect 沿用输入——晚子时日柱是否换日即由 sect 决定。
 */
export function buildHourCandidates(input: BaziInput): HourCandidate[] {
  const base: BaziInput = {
    year: input.year, month: input.month, day: input.day,
    hour: 0, minute: 0,
    gender: input.gender, sect: input.sect,
  };
  const out: HourCandidate[] = [];
  HOUR_REPRESENTATIVES.forEach((t, index) => {
    let chart: BaziResult | null = null;
    try {
      chart = calculateBazi({ ...base, hour: t.hour, minute: t.minute });
    } catch {
      return;
    }
    if (!chart?.pillars?.time) return;
    const P = chart.pillars;
    const timeGz = `${P.time.gan}${P.time.zhi}`;
    const zhiMain = Array.isArray(P.time.hideGanAttr) && P.time.hideGanAttr.length ? P.time.hideGanAttr[0] : null;
    out.push({
      index,
      label: t.label,
      range: t.range,
      hour: t.hour,
      minute: t.minute,
      pillarsText: (['year', 'month', 'day', 'time'] as const).map((k) => `${P[k].gan}${P[k].zhi}`).join(' '),
      dayGz: `${P.day.gan}${P.day.zhi}`,
      timeGz,
      tGanShen: String(P.time.shiShenGan ?? ''),
      tZhiShen: String(zhiMain?.shiShen ?? ''),
      dayChanged: false, // 占位，下方与丑~亥基准比对后回填
      qiYun: chart.yun?.startSolar ? `${chart.yun.startSolar.slice(0, 10)}（${chart.yun.forward ? '顺' : '逆'}）` : '',
      mingGong: String((chart as { mingGong?: string }).mingGong ?? ''),
      chart,
    });
  });
  // 晚子时换日检测：丑~亥（含早子）日柱恒同为基准；正统派晚子时日柱进一日
  const baseDay = out.find((c) => c.index >= 1 && c.index <= 11)?.dayGz;
  for (const c of out) c.dayChanged = !!baseDay && c.dayGz !== baseDay;
  return out;
}

/** 单张盘的特征命中位图（与 TRAITS 顺序对应） */
export function traitHits(c: HourCandidate): boolean[] {
  return TRAITS.map((t) => {
    try {
      return t.test(c);
    } catch {
      return false;
    }
  });
}

// 大事年份反查阈值（启发式，仅供缩小范围）：K线总运 0-100、日线涨跌 delta
const GOOD_SCORE = 60;
const GOOD_DELTA = 6;
const BAD_SCORE = 45;
const BAD_DELTA = -6;
const BAD_FACTOR = /冲提纲|天克地冲|伏吟|岁运并临|七杀攻身|入空亡|逢冲/;

/** 大事年份反查：该盘 K 线在事件年份是否呈相应形态（好事=高分/大涨，动荡=低分/大跌/凶性因素） */
export function matchEvents(chart: BaziResult, events: LifeEvent[]): boolean[] {
  const valid = events.filter((e) => e.year > 1900);
  if (!valid.length) return events.map(() => false);
  const k = buildLifeKline(chart);
  return events.map((e) => {
    if (!k || e.year <= 1900) return false;
    const y = k.years.find((x) => x.year === e.year);
    if (!y) return false;
    if (e.kind === 'good') return y.scores.total >= GOOD_SCORE || y.delta.total >= GOOD_DELTA;
    return y.scores.total <= BAD_SCORE || y.delta.total <= BAD_DELTA || y.factors.total.some((f) => BAD_FACTOR.test(f));
  });
}

/** 匹配分：勾选特征命中 ×1 + 大事年份命中 ×2（口径同 react-zwds） */
export function scoreCandidate(hits: boolean[], checkedIds: Set<string>, eventHits: boolean[]): number {
  let s = 0;
  TRAITS.forEach((t, i) => {
    if (checkedIds.has(t.id) && hits[i]) s += 1;
  });
  for (const h of eventHits) if (h) s += 2;
  return s;
}
