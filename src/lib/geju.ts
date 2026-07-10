// 格局自动判定（子平真诠取格法的机械部分）：
//   月令本气透干 → 取之；不透 → 取月令中气/余气透出者；诸藏皆不透 → 以本气取格；
//   比劫当令（建禄/阳刃/月劫）不入八格 → 取他干透出者变通成格。
//
// 动机：提示词的格局派视角有方法论但无预计算数据——取格是纯机械规则，程序算好；
// 成败、救应、高低这些判断力活留给 AI。相神/忌神按子平真诠顺逆用配置给出候选，
// 并扫描原局透藏呈现；人元司令之干透出且异于所取时出「异说」注（分野取格口径）。
import { getShiShen } from './engine/mystilight/ext/shishen';

type GZ = { gan: string; zhi: string; hideGanAttr?: { gan: string; qiLevel: string; shiShen: string }[] };
type PillarsLike = { year: GZ; month: GZ; day: GZ; time: GZ };

// 日主之禄支 / 阳刃支（阳干）
const LU_ZHI: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const REN_ZHI: Record<string, string> = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };

// 四吉神顺用 / 四凶神逆用
const SHUN = new Set(['正官', '正财', '偏财', '正印', '食神']);
const NI = new Set(['七杀', '伤官', '偏印']);

// 各格的相神/忌神候选（子平真诠顺逆用配置；「格局带病」之病即忌神）
const XIANG_JI: Record<string, { xiang: [string, string][]; ji: [string, string][] }> = {
  正官: { xiang: [['正财', '财生官'], ['正印', '印护官']], ji: [['伤官', '伤官见官'], ['七杀', '官杀混杂']] },
  七杀: { xiang: [['食神', '食神制杀'], ['正印', '印化杀'], ['偏印', '枭化杀']], ji: [['正财', '财党杀'], ['偏财', '财党杀']] },
  正财: { xiang: [['食神', '食神生财'], ['伤官', '伤官生财'], ['正官', '官护财']], ji: [['比肩', '比肩夺财'], ['劫财', '劫财夺财']] },
  偏财: { xiang: [['食神', '食神生财'], ['伤官', '伤官生财'], ['正官', '官护财']], ji: [['比肩', '比肩夺财'], ['劫财', '劫财夺财']] },
  正印: { xiang: [['正官', '官生印'], ['七杀', '杀生印']], ji: [['正财', '财坏印'], ['偏财', '财坏印']] },
  偏印: { xiang: [['偏财', '财制枭']], ji: [['食神', '枭神夺食']] },
  食神: { xiang: [['正财', '食神生财'], ['偏财', '食神生财'], ['七杀', '食神制杀']], ji: [['偏印', '枭神夺食']] },
  伤官: { xiang: [['正印', '伤官配印'], ['正财', '伤官生财'], ['偏财', '伤官生财']], ji: [['正官', '伤官见官']] },
};

export interface GeJuGodStatus {
  shiShen: string;
  /** 该神在此格中的作用，如「食神制杀」 */
  role: string;
  /** 原局呈现：透于X干 / 藏于X支本气 / 原局不见 */
  status: string;
  present: boolean;
}

export interface GeJuResult {
  /** 格名，如「七杀格」「月劫用官（变通）」 */
  ge: string;
  type: '吉神顺用' | '凶神逆用' | '禄刃另论';
  /** 取格依据一句话 */
  basis: string;
  xiangShen: GeJuGodStatus[];
  jiShen: GeJuGodStatus[];
  /** 一句话初判（成败救应细辨留给 AI） */
  verdict: string;
  /** 人元司令异说（分野取格口径） */
  siLingNote?: string;
  source: string;
}

const PILLAR_CN: Record<string, string> = { year: '年', month: '月', time: '时' };

/** 扫描某十神在原局的呈现（透干优先，支本气次之；日干为日主不计） */
function scanGod(pillars: PillarsLike, dayGan: string, target: string): { status: string; present: boolean } {
  const tou: string[] = [];
  for (const k of ['year', 'month', 'time'] as const) {
    if (getShiShen(dayGan, pillars[k].gan) === target) tou.push(`${PILLAR_CN[k]}干`);
  }
  if (tou.length) return { status: `透于${tou.join('、')}`, present: true };
  const cang: string[] = [];
  for (const k of ['year', 'month', 'day', 'time'] as const) {
    const main = pillars[k].hideGanAttr?.[0];
    if (main && getShiShen(dayGan, main.gan) === target) cang.push(`${k === 'day' ? '日' : PILLAR_CN[k]}支`);
  }
  if (cang.length) return { status: `藏于${cang.join('、')}本气`, present: true };
  return { status: '原局不见', present: false };
}

function godList(pillars: PillarsLike, dayGan: string, defs: [string, string][]): GeJuGodStatus[] {
  return defs.map(([ss, role]) => {
    const s = scanGod(pillars, dayGan, ss);
    return { shiShen: ss, role, status: s.status, present: s.present };
  });
}

/**
 * 子平真诠机械取格。
 * @param siLingGan 人元司令之干（可选；透出且异于所取时出异说注）
 */
export function analyzeGeJu(pillars: PillarsLike | undefined, siLingGan?: string): GeJuResult | null {
  const dayGan = pillars?.day?.gan;
  const month = pillars?.month;
  if (!dayGan || !month?.zhi) return null;
  const hides = month.hideGanAttr ?? [];
  if (!hides.length) return null;

  const touGans = (['year', 'month', 'time'] as const).map((k) => pillars[k].gan);
  const isTou = (g: string) => touGans.includes(g);

  const mainGan = hides[0].gan;
  const mainShen = getShiShen(dayGan, mainGan);

  let ge = '';
  let geShen = '';
  let basis = '';
  let type: GeJuResult['type'];

  if (mainShen === '比肩' || mainShen === '劫财') {
    // ── 禄刃另论：建禄 / 阳刃 / 月劫，取他干透出者变通成格 ──
    const luLabel = month.zhi === LU_ZHI[dayGan] ? '建禄' : month.zhi === REN_ZHI[dayGan] ? '阳刃' : '月劫';
    type = '禄刃另论';
    const PRIORITY = ['正官', '七杀', '正财', '偏财', '食神', '伤官', '正印', '偏印'];
    const usable = PRIORITY.find((ss) => touGans.some((g) => getShiShen(dayGan, g) === ss));
    if (usable) {
      geShen = usable;
      ge = `${luLabel}用${usable}（变通）`;
      basis = `月令${month.zhi}本气${mainGan}为${mainShen}当令，${luLabel}不入八格；天干透${usable}，变通取之为用`;
    } else {
      ge = `${luLabel}格`;
      basis = `月令${month.zhi}本气${mainGan}为${mainShen}当令（${luLabel}），天干无财官食伤可取，喜运岁透出成用`;
    }
  } else {
    // ── 八格正取：本气透 > 中/余气透 > 以本气直取 ──
    const touHit = hides.find((h) => isTou(h.gan));
    if (touHit) {
      geShen = getShiShen(dayGan, touHit.gan);
      ge = `${geShen}格`;
      const pos = (['year', 'month', 'time'] as const).filter((k) => pillars[k].gan === touHit.gan).map((k) => `${PILLAR_CN[k]}干`).join('、');
      basis = `月令${month.zhi}藏${touHit.gan}（${touHit.qiLevel}）透于${pos}，取${geShen}为格`;
    } else {
      geShen = mainShen;
      ge = `${geShen}格`;
      basis = `月令${month.zhi}诸藏皆不透，以本气${mainGan}取${geShen}格`;
    }
    type = SHUN.has(geShen) ? '吉神顺用' : NI.has(geShen) ? '凶神逆用' : '吉神顺用';
  }

  const cfg = geShen ? XIANG_JI[geShen] : undefined;
  const xiangShen = cfg ? godList(pillars, dayGan, cfg.xiang) : [];
  const jiShen = cfg ? godList(pillars, dayGan, cfg.ji) : [];

  // ── 一句话初判（存在性层面；轻重成败由 AI 细辨）──
  const xTou = xiangShen.filter((x) => x.status.startsWith('透'));
  const xCang = xiangShen.filter((x) => x.status.startsWith('藏'));
  const jTou = jiShen.filter((x) => x.status.startsWith('透'));
  let verdict: string;
  if (!cfg) verdict = '禄刃无透可用，格局待运岁成之';
  else if (xTou.length && !jTou.length) verdict = `相神${xTou.map((x) => x.shiShen).join('、')}透干且忌神不透，有成格之象`;
  else if (xTou.length && jTou.length) verdict = `相神${xTou.map((x) => x.shiShen).join('、')}与忌神${jTou.map((x) => x.shiShen).join('、')}并透，成中有败，须细辨救应`;
  else if (jTou.length) verdict = `忌神${jTou.map((x) => x.shiShen).join('、')}透干（${jiShen.find((j) => j.status.startsWith('透'))?.role}），格局带病，喜制化为救`;
  else if (xCang.length) verdict = `相神${xCang.map((x) => x.shiShen).join('、')}藏支不透，格局清而力浅，喜运岁引出`;
  else verdict = '相神原局不见，格局孤弱，赖运岁补相神';

  // ── 人元司令异说（司令干透出、所主十神异于所取、且非比劫帮身时才有取格分歧）──
  let siLingNote: string | undefined;
  if (siLingGan && isTou(siLingGan)) {
    const slShen = getShiShen(dayGan, siLingGan);
    if (slShen && slShen !== geShen && slShen !== '比肩' && slShen !== '劫财') {
      siLingNote = `人元司令${siLingGan}（${slShen}）透干，按分野取格口径或以${slShen}格论——流派异说，可两存之`;
    }
  }

  return {
    ge, type, basis, xiangShen, jiShen, verdict,
    ...(siLingNote ? { siLingNote } : {}),
    source: '子平真诠取格法（机械判定；成败高低须结合清浊、有情无情细辨）',
  };
}
