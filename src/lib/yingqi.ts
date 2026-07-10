// 应期引动预检：按传统引动规则逐年扫描「婚恋/事业/财运」的候选应期年份。
//
// 动机：「哪年结婚/发财/升职」是问 AI 最多的题型，让 AI 自己扫百年流年找引动极易漏算。
// 引动是确定性规则——星透干、星合日主、星临太岁、宫逢合冲、财库冲开、星运放大——
// 程序算好候选清单与线索，轻重与真假应期由 AI 结合大运喜忌细断。
// 输出为「候选提示」而非事件预言，强度仅为线索计数。
import type { BaziResult } from './bazi';
import { getShiShen } from './engine/mystilight/ext/shishen';
import { getGanWuXing, ZHI_MAIN_GAN } from './utils';
import { TIAN_GAN } from './engine/mystilight/ext/constants';

const KE: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const CHONG: Record<string, string> = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const LIU_HE: Record<string, string> = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const TRINE: Record<string, number> = { 申: 0, 子: 0, 辰: 0, 亥: 1, 卯: 1, 未: 1, 寅: 2, 午: 2, 戌: 2, 巳: 3, 酉: 3, 丑: 3 };
const WU_HE: Record<string, string> = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
// 五行墓库（土库有火土/水土同宫之流派分歧，跳过不用）
const KU_ZHI: Record<string, string> = { 木: '未', 火: '戌', 金: '丑', 水: '辰' };
const FULL_SHORT: Record<string, string> = { 正财: '财', 偏财: '才', 正官: '官', 七杀: '杀' };

export type YingQiTopic = '婚恋' | '事业' | '财运';

export interface YingQiHit {
  year: number;
  ganZhi: string;
  age: number;
  dayun: string;
  /** 线索计数（≥2 才入选） */
  strength: number;
  reasons: string[];
}

export interface YingQiResult {
  topic: YingQiTopic;
  /** 目标星描述，如「正财甲（主）、偏财乙（次）」 */
  starDesc: string;
  /** 宫位描述（财运无固定宫） */
  palaceDesc?: string;
  note: string;
  hits: YingQiHit[];
}

/**
 * 扫描候选应期。
 * @param range 公历年范围（含端点）；缺省扫全部流年
 */
export function analyzeYingQi(
  chart: BaziResult,
  topic: YingQiTopic,
  range?: { from?: number; to?: number },
): YingQiResult | null {
  const p = chart.pillars;
  const dayGan = p?.day?.gan;
  if (!dayGan) return null;
  const gender = chart.gender || '男';
  const birthYear = chart.input.year;

  // ── 目标星与宫位 ──
  let primary: string;
  let secondary: string;
  let palace: string | undefined;
  let palaceName = '';
  if (topic === '婚恋') {
    primary = gender === '女' ? '正官' : '正财';
    secondary = gender === '女' ? '七杀' : '偏财';
    palace = p.day.zhi;
    palaceName = `婚姻宫（日支${palace}）`;
  } else if (topic === '事业') {
    primary = '正官';
    secondary = '七杀';
    palace = p.month.zhi;
    palaceName = `事业宫（月支${palace}）`;
  } else {
    primary = '正财';
    secondary = '偏财';
  }
  const pGan = TIAN_GAN.find((g) => getShiShen(dayGan, g) === primary) ?? '';
  const sGan = TIAN_GAN.find((g) => getShiShen(dayGan, g) === secondary) ?? '';

  // 财库（仅财运主题；库支须在原局，逢冲方为「冲开」）
  const caiWx = KE[getGanWuXing(dayGan)];
  const kuZhi = topic === '财运' ? KU_ZHI[caiWx] : undefined;
  const natalZhis = new Set([p.year.zhi, p.month.zhi, p.day.zhi, p.time.zhi]);

  const dayunArr = (chart as any).dayunArr as {
    ganZhi: string; ganshen?: string; zhishen?: string;
    liunianArr?: { year: number; ganZhi: string }[];
  }[] | undefined;
  if (!dayunArr?.length) return null;

  const from = range?.from ?? -Infinity;
  const to = range?.to ?? Infinity;
  const starShorts = [FULL_SHORT[primary], FULL_SHORT[secondary]].filter(Boolean);

  const hits: YingQiHit[] = [];
  for (const dy of dayunArr) {
    const inStarYun = !!dy.ganZhi && starShorts.some((s) => dy.ganshen === s || dy.zhishen === s);
    for (const ln of dy.liunianArr ?? []) {
      if (ln.year < from || ln.year > to || !ln.ganZhi || ln.ganZhi.length < 2) continue;
      const g = ln.ganZhi[0];
      const z = ln.ganZhi[1];
      let strength = 0;
      const reasons: string[] = [];
      const add = (v: number, r: string) => { strength += v; reasons.push(r); };

      // 星透干（主星强于次星）；主星恰合日主为强应
      if (g === pGan) {
        add(2, `${primary}${pGan}透干`);
        if (WU_HE[dayGan] === g) add(2, `${primary}合入日主（强应）`);
      } else if (sGan && g === sGan) {
        add(1, `${secondary}${sGan}透干`);
      }

      // 星临太岁（流年支本气为目标星）
      const zShen = getShiShen(dayGan, ZHI_MAIN_GAN[z] ?? '');
      if (zShen === primary) add(1, `${primary}临太岁（支藏）`);
      else if (zShen === secondary) add(1, `${secondary}临太岁（支藏）`);

      // 宫位引动（合最吉，冲为动中有变，半合为次）
      if (palace) {
        if (LIU_HE[z] === palace) add(2, `流年${z}合动${palaceName}`);
        else if (CHONG[z] === palace) add(1, `流年${z}冲动${palaceName}（动中有变）`);
        else if (z !== palace && TRINE[z] !== undefined && TRINE[z] === TRINE[palace]) add(1, `流年${z}半合${palaceName}`);
      }

      // 财库冲开
      if (kuZhi && natalZhis.has(kuZhi) && CHONG[z] === kuZhi) add(2, `流年${z}冲开财库${kuZhi}`);

      // 星运放大
      if (strength > 0 && inStarYun) add(1, `所行${dy.ganZhi}运为星运，应期尤真`);

      if (strength >= 2) {
        hits.push({
          year: ln.year, ganZhi: ln.ganZhi, age: ln.year - birthYear + 1,
          dayun: dy.ganZhi || '', strength, reasons,
        });
      }
    }
  }

  hits.sort((a, b) => b.strength - a.strength || a.year - b.year);

  return {
    topic,
    starDesc: `${primary}${pGan}（主）${sGan ? `、${secondary}${sGan}（次）` : ''}`,
    ...(palaceName ? { palaceDesc: palaceName } : {}),
    note: '应期为传统引动规则（星透干/星合日主/星临太岁/宫逢合冲/财库冲开/星运放大）的候选提示，非事件预言；强度为线索计数，真假应期须结合大运喜忌与原局细断',
    hits,
  };
}
