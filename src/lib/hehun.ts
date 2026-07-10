// 合婚双盘对照：确定性互动清单 + 喂 AI 的合婚 Markdown。
//
// 口径：只列「盘面事实级」互动（宫星合冲刑害、互为十神、喜用互补、调候互济、空亡、
// 婚恋相关日柱形态），标注 吉/平/忌，不打总分——合婚为传统民俗参考，轻重由 AI
// 结合全局论述，结论不构成婚姻决策依据。
import type { BaziInput, BaziResult } from './bazi';
import { getShiShen } from './engine/mystilight/ext/shishen';
import { getGanWuXing } from './utils';
import { WARMTH_NEED } from './dili';
import { buildLifeKline } from './lifekline';
import { detectPatterns } from './patterns';

// ─── 基础表（与 lifekline 同源的小表，按仓库惯例就地维护）─
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
const WU_HE: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
const TRINE: Record<string, number> = { 申: 0, 子: 0, 辰: 0, 亥: 1, 卯: 1, 未: 1, 寅: 2, 午: 2, 戌: 2, 巳: 3, 酉: 3, 丑: 3 };
const SELF_XING = new Set(['辰', '午', '酉', '亥']);
const WX_ALL = ['木', '火', '土', '金', '水'];

export type HehunPolarity = '吉' | '平' | '忌';

export interface HehunItem {
  /** 维度，如「婚姻宫互动」 */
  aspect: string;
  /** 事实，如「亥未同属亥卯未三合（半合拱卯）」 */
  finding: string;
  /** 一句义 */
  note: string;
  polarity: HehunPolarity;
}

export interface HehunPerson {
  label: string;
  gender: string;
  dayGan: string;
  dayZhi: string;
  yearZhi: string;
  pillarText: string;
  judge: string;
}

export interface HehunResult {
  a: HehunPerson;
  b: HehunPerson;
  items: HehunItem[];
  counts: Record<HehunPolarity, number>;
}

interface Party { label: string; input: BaziInput; chart: BaziResult }

const pillarsText = (c: BaziResult) =>
  (['year', 'month', 'day', 'time'] as const).map((k) => c.pillars[k].gan + c.pillars[k].zhi).join(' ');

// 支对支关系（合婚双盘只看两支间的直接作用）
function zhiPair(z1: string, z2: string): { finding: string; polarity: HehunPolarity; note: string } | null {
  if (LIU_HE[z1] === z2) return { finding: `${z1}${z2}六合`, polarity: '吉', note: '相合相亲，情意易通' };
  if (CHONG[z1] === z2) return { finding: `${z1}${z2}相冲`, polarity: '忌', note: '对冲则动荡，易聚少离多或多磨合，须经营' };
  if (z1 === z2) {
    if (SELF_XING.has(z1)) return { finding: `${z1}${z2}自刑`, polarity: '忌', note: '同支自刑，易内耗纠结' };
    return { finding: `${z1}${z2}同支（伏吟）`, polarity: '平', note: '同气相应，平淡中见默契，亦防彼此消磨' };
  }
  if (XING[z1]?.includes(z2)) return { finding: `${z1}${z2}相刑`, polarity: '忌', note: '相刑主是非磨擦，宜多包容' };
  if (HAI[z1] === z2) return { finding: `${z1}${z2}相害`, polarity: '忌', note: '相害主暗损嫌隙，轻于冲刑' };
  if (TRINE[z1] !== undefined && TRINE[z1] === TRINE[z2]) return { finding: `${z1}${z2}半三合`, polarity: '吉', note: '同局相拱，气类相投' };
  return null;
}

// 由身强弱推喜/忌五行（中和返回 null 不作互补断言）
function favSets(dayWx: string, judge: string): { like: string[]; dislike: string[] } | null {
  const yin = WX_ALL.find((e) => SHENG[e] === dayWx)!;
  const shiShang = SHENG[dayWx];
  const cai = KE[dayWx];
  const guanSha = WX_ALL.find((e) => KE[e] === dayWx)!;
  if (judge === '身弱') return { like: [yin, dayWx], dislike: [shiShang, cai, guanSha] };
  if (judge === '身强') return { like: [shiShang, cai, guanSha], dislike: [yin, dayWx] };
  return null;
}

function topElements(chart: BaziResult, n = 2): string[] {
  const wx = (chart.wuXingPower ?? {}) as Record<string, number>;
  return [...WX_ALL].sort((x, y) => (Number(wx[y]) || 0) - (Number(wx[x]) || 0)).slice(0, n);
}

/** 合婚双盘确定性分析 */
export function analyzeHehun(pa: Party, pb: Party): HehunResult {
  const items: HehunItem[] = [];
  const push = (aspect: string, finding: string, note: string, polarity: HehunPolarity) =>
    items.push({ aspect, finding, note, polarity });

  const mk = (p: Party): HehunPerson => {
    const k = buildLifeKline(p.chart);
    return {
      label: p.label,
      gender: p.chart.gender || (p.input.gender === 1 ? '男' : '女'),
      dayGan: p.chart.pillars.day.gan,
      dayZhi: p.chart.pillars.day.zhi,
      yearZhi: p.chart.pillars.year.zhi,
      pillarText: pillarsText(p.chart),
      judge: k?.judge ?? '未知',
    };
  };
  const A = mk(pa);
  const B = mk(pb);

  // ── ① 日干互动 ──
  if (WU_HE[A.dayGan] === B.dayGan) {
    push('日干互动', `${A.dayGan}${B.dayGan}五合`, '天干相合，性情相契、缘分之象', '吉');
  } else {
    const wa = getGanWuXing(A.dayGan);
    const wb = getGanWuXing(B.dayGan);
    if (SHENG[wa] === wb) push('日干互动', `${A.label}日干${A.dayGan}生${B.label}日干${B.dayGan}`, `情意流向${B.label}，${A.label}多付出`, '吉');
    else if (SHENG[wb] === wa) push('日干互动', `${B.label}日干${B.dayGan}生${A.label}日干${A.dayGan}`, `情意流向${A.label}，${B.label}多付出`, '吉');
    else if (KE[wa] === wb) push('日干互动', `${A.label}日干${A.dayGan}克${B.label}日干${B.dayGan}`, `${A.label}偏主导、${B.label}多迁就，宜留沟通空间`, '平');
    else if (KE[wb] === wa) push('日干互动', `${B.label}日干${B.dayGan}克${A.label}日干${A.dayGan}`, `${B.label}偏主导、${A.label}多迁就，宜留沟通空间`, '平');
    else push('日干互动', `${A.dayGan}${B.dayGan}比和`, '性气相类，平等相处，亦防互不相让', '平');
  }

  // ── ② 互为十神 + 配偶星应象 ──
  const bOfA = getShiShen(A.dayGan, B.dayGan);
  const aOfB = getShiShen(B.dayGan, A.dayGan);
  push('互为十神', `${B.label}日干为${A.label}之「${bOfA}」，${A.label}日干为${B.label}之「${aOfB}」`, '以十神义看彼此角色感（参考象法表）', '平');
  if (A.gender === '男' && bOfA === '正财') push('配偶星应象', `${B.label}日干恰为${A.label}之正财（妻星）`, '妻星应象于对方本命，古法视为夫妻缘分之应', '吉');
  if (A.gender === '女' && bOfA === '正官') push('配偶星应象', `${B.label}日干恰为${A.label}之正官（夫星）`, '夫星应象于对方本命，古法视为夫妻缘分之应', '吉');
  if (B.gender === '男' && aOfB === '正财') push('配偶星应象', `${A.label}日干恰为${B.label}之正财（妻星）`, '妻星应象于对方本命，古法视为夫妻缘分之应', '吉');
  if (B.gender === '女' && aOfB === '正官') push('配偶星应象', `${A.label}日干恰为${B.label}之正官（夫星）`, '夫星应象于对方本命，古法视为夫妻缘分之应', '吉');

  // ── ③ 婚姻宫（日支）互动 ──
  const dz = zhiPair(A.dayZhi, B.dayZhi);
  if (dz) push('婚姻宫互动', `双方日支 ${dz.finding}`, dz.note, dz.polarity);
  else push('婚姻宫互动', `双方日支 ${A.dayZhi}/${B.dayZhi} 无明显合冲刑害`, '婚姻宫互动平和', '平');

  // ── ④ 年支属相 ──
  const yz = zhiPair(A.yearZhi, B.yearZhi);
  if (yz) {
    const note = yz.polarity === '忌' ? `${yz.note}（属相之说民俗色彩重，现代宜弱化看待）` : yz.note;
    push('年支属相', `双方年支 ${yz.finding}`, note, yz.polarity);
  }

  // ── ⑤ 喜用五行互补（双向）──
  const compl = (self: HehunPerson, other: HehunPerson, otherChart: BaziResult) => {
    const sets = favSets(getGanWuXing(self.dayGan), self.judge);
    if (!sets) {
      push('喜用互补', `${self.label}日主中和`, '喜忌不偏，对方五行无明显助碍', '平');
      return;
    }
    const top = topElements(otherChart);
    const likeHit = top.filter((e) => sets.like.includes(e));
    const disHit = top.filter((e) => sets.dislike.includes(e));
    if (likeHit.length) push('喜用互补', `${other.label}命局${likeHit.join('、')}旺，恰为${self.label}（${self.judge}）之喜用`, '五行互补，相处滋养', '吉');
    else if (disHit.length) push('喜用互补', `${other.label}命局${disHit.join('、')}旺，为${self.label}（${self.judge}）之忌神`, '五行有碍，相处须防对应之扰（可后天调和）', '忌');
    else push('喜用互补', `${other.label}命局旺行对${self.label}喜忌不显`, '互补与冲突皆不明显', '平');
  };
  compl(A, B, pb.chart);
  compl(B, A, pa.chart);

  // ── ⑥ 调候互济 ──
  const needA = WARMTH_NEED[pa.chart.pillars.month.zhi] ?? 0;
  const needB = WARMTH_NEED[pb.chart.pillars.month.zhi] ?? 0;
  if (needA >= 0.5 && needB <= -0.5) push('调候互济', `${A.label}生寒月、${B.label}生燥月`, '一寒一燥，气候互济，性情节奏易互补', '吉');
  else if (needB >= 0.5 && needA <= -0.5) push('调候互济', `${B.label}生寒月、${A.label}生燥月`, '一寒一燥，气候互济，性情节奏易互补', '吉');
  else if (needA >= 0.5 && needB >= 0.5) push('调候互济', '双方皆生于寒月', '家庭气氛宜主动添暖（火之事象：热闹、运动、南向）', '平');
  else if (needA <= -0.5 && needB <= -0.5) push('调候互济', '双方皆生于燥月', '相处宜静宜润（水之事象：旅行近水、心平气和）', '平');

  // ── ⑦ 空亡互落 ──
  const kong = (self: Party, selfP: HehunPerson, other: HehunPerson) => {
    const xk = self.chart.pillars.day.xunKong || '';
    if (xk.includes(other.dayZhi)) {
      push('空亡参照', `${other.label}婚姻宫（日支${other.dayZhi}）落${selfP.label}之日柱旬空（${xk}）`, '古法谓缘分易有虚耗感，仅作参考、逢合冲可解', '忌');
    }
  };
  kong(pa, A, B);
  kong(pb, B, A);

  // ── ⑧ 婚恋相关日柱形态（各自盘）──
  for (const [p, per] of [[pa, A], [pb, B]] as const) {
    const pats = detectPatterns(p.chart.pillars as any).filter((x) => /孤鸾|阴阳差错|魁罡/.test(x.name));
    for (const x of pats) push('日柱形态', `${per.label}：${x.name}（${x.hit}）`, x.note, '平');
  }

  const counts: Record<HehunPolarity, number> = { 吉: 0, 平: 0, 忌: 0 };
  for (const it of items) counts[it.polarity]++;
  return { a: A, b: B, items, counts };
}

// ─── 合婚结构化导出数据（供 TOON/JSON 序列化）────────────

export function buildHehunExportData(pa: Party, pb: Party, r: HehunResult) {
  const person = (p: Party, per: HehunPerson) => {
    const an: any = (p.chart as any).analysis;
    return {
      name: per.label,
      gender: per.gender,
      birth: {
        year: p.input.year, month: p.input.month, day: p.input.day,
        hour: p.input.hour, minute: p.input.minute,
        ...(p.input.city ? { city: p.input.city } : {}),
      },
      pillars: per.pillarText,
      dayMaster: `${per.dayGan}${getGanWuXing(per.dayGan)}`,
      judge: per.judge,
      ...(Array.isArray(an?.XiYongShen) && an.XiYongShen.length ? { xiYongShen: an.XiYongShen } : {}),
    };
  };
  return {
    meta: {
      tool: '八字合婚对照 (react-8char)',
      generatedAt: new Date().toISOString(),
      disclaimer: '合婚为传统民俗参考，结论不构成婚姻决策依据',
    },
    a: person(pa, r.a),
    b: person(pb, r.b),
    counts: r.counts,
    items: r.items,
    aiNote: '轻重与化解由 AI 结合全局论述（不设总分）；「忌」项须同时给化解视角；关键结论标注置信度',
  };
}

// ─── 合婚 Markdown（喂 AI）───────────────────────────────

export function buildHehunMarkdown(pa: Party, pb: Party, r: HehunResult): string {
  const L: string[] = [];
  const push = (...xs: string[]) => L.push(...xs);

  push(
    '你是一位精通八字合婚的资深命理分析师。以下为两人命盘与程序预检的确定性互动清单，请据此做合婚分析。',
    '',
    '> 免责：合婚为传统民俗参考，结论不构成婚姻决策依据；请以建设性、可行动的相处建议为落点，避免宿命化断语。',
    '', '---', '',
    '# 合婚对照',
    '',
  );

  const person = (p: Party, per: HehunPerson) => {
    push(`## ${per.label}（${per.gender === '男' ? '乾造' : '坤造'}）`, '');
    push(`- 公历 ${p.input.year}-${p.input.month}-${p.input.day} ${p.input.hour}:${String(p.input.minute).padStart(2, '0')}${p.input.city ? ` · ${p.input.city}` : ''}`);
    push(`- 四柱：**${per.pillarText}**（日主${per.dayGan}${getGanWuXing(per.dayGan)}，${per.judge}）`);
    const P = p.chart.pillars;
    push(`- 十神：年${P.year.shiShenGan}/月${P.month.shiShenGan}/时${P.time.shiShenGan}；支本气 ${(['year', 'month', 'day', 'time'] as const).map((k) => { const v = (P[k] as any).shiShenZhi; return Array.isArray(v) ? v[0] : v; }).join('/')}`);
    const an: any = (p.chart as any).analysis;
    if (Array.isArray(an?.XiYongShen) && an.XiYongShen.length) push(`- 喜用神（引擎）：${an.XiYongShen.join('、')}`);
    push('');
  };
  person(pa, r.a);
  person(pb, r.b);

  push('## 互动清单（程序预检）', '');
  push(`> 计 吉 ${r.counts['吉']} · 平 ${r.counts['平']} · 忌 ${r.counts['忌']}（存在性事实；轻重与化解由你结合全局论述，不设总分）`, '');
  for (const pol of ['吉', '平', '忌'] as const) {
    const list = r.items.filter((x) => x.polarity === pol);
    if (!list.length) continue;
    push(`### ${pol}`, '');
    list.forEach((x) => push(`- **［${x.aspect}］**${x.finding}——${x.note}`));
    push('');
  }

  push(
    '---', '',
    '## 分析框架',
    '',
    '1. **缘分与吸引**：日干互动、配偶星应象、婚姻宫合冲——两人因何相吸，缘分深浅',
    '2. **性格磨合**：互为十神的角色感 + 各自日主心性——谁主导、易在何事上起摩擦',
    '3. **五行互济**：喜用互补与调候互济——同处对彼此运势气场的实际助碍',
    '4. **风险点与化解**：忌类互动逐条给化解之道（沟通方式/居住方位/相处节奏），勿只报忧',
    '5. **相处建议**：三条以内、可执行',
    '',
    '纪律：只引用上列盘面与清单为据，勿另行排盘或凭记忆补神煞；关键结论标注置信度（高/中/低）；「忌」项须同时给化解视角。',
  );

  return L.join('\n');
}
