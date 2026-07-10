// 五行能量计点:干支计点法下的五行结构占比,分「原局 / 原局+大运 / 原局+大运+流年」三层叠加。
//
// 方法(结构占比,非旺衰):每天干计 100 点入其五行;每地支按藏干气级分拆 100 点——
// 单藏 100、双藏 70/30、三藏 60/30/10(本/中/余)。原局八字共 800 点,大运/流年各计一柱 200 点。
// 与引擎 wuXingPower(含得令加成的旺衰值)口径不同:此处回答「岁运叠加后盘面结构怎么变形」,
// 供五行能量多边形(雷达)与导出引用;喜忌标注用扶抑口径(likeElements)。
// 藏干集合与次序同引擎 hideGanAttr(测试对拍锁定),权重为通行计点约定。
import { getGanWuXing } from './utils';
import { SHENG, KE } from './ganzhi';
import { likeElements } from './yunpatterns';

/** 地支藏干计点(每支共 100 点;序=本气→中气→余气,与引擎 hideGanAttr 一致) */
export const ZHI_CANG_POINTS: Record<string, [string, number][]> = {
  子: [['癸', 100]],
  丑: [['己', 60], ['癸', 30], ['辛', 10]],
  寅: [['甲', 60], ['丙', 30], ['戊', 10]],
  卯: [['乙', 100]],
  辰: [['戊', 60], ['乙', 30], ['癸', 10]],
  巳: [['丙', 60], ['庚', 30], ['戊', 10]],
  午: [['丁', 70], ['己', 30]],
  未: [['己', 60], ['丁', 30], ['乙', 10]],
  申: [['庚', 60], ['壬', 30], ['戊', 10]],
  酉: [['辛', 100]],
  戌: [['戊', 60], ['辛', 30], ['丁', 10]],
  亥: [['壬', 70], ['甲', 30]],
};

const WX_ALL = ['木', '火', '土', '金', '水'] as const;
export type WuXingName = (typeof WX_ALL)[number];

type GZ = { gan: string; zhi: string };
type PillarsLike = { year: GZ; month: GZ; day: GZ; time: GZ };

export interface WuxingEnergyLayer {
  /** 层名:原局 / +大运X / +流年X */
  label: string;
  points: Record<string, number>;
  /** 占比(0-100,一位小数) */
  percent: Record<string, number>;
}

export interface WuxingEnergyData {
  method: string;
  dayGan: string;
  dayWx: string;
  /** 各五行相对日主的十神组:木→比劫 之类 */
  groupOf: Record<string, string>;
  /** 扶抑口径喜行(身强弱未判/中和时缺省) */
  likes?: string[];
  layers: WuxingEnergyLayer[];
}

/** 单柱干支计点(干 100 + 支藏干 100) */
function pillarPoints(gz: { gan: string; zhi: string }, acc: Record<string, number>) {
  const gw = getGanWuXing(gz.gan);
  if (gw) acc[gw] = (acc[gw] ?? 0) + 100;
  for (const [cg, pts] of ZHI_CANG_POINTS[gz.zhi] ?? []) {
    const w = getGanWuXing(cg);
    if (w) acc[w] = (acc[w] ?? 0) + pts;
  }
}

function toLayer(label: string, acc: Record<string, number>): WuxingEnergyLayer {
  const total = WX_ALL.reduce((s, w) => s + (acc[w] ?? 0), 0) || 1;
  const points: Record<string, number> = {};
  const percent: Record<string, number> = {};
  for (const w of WX_ALL) {
    points[w] = acc[w] ?? 0;
    percent[w] = Math.round(((acc[w] ?? 0) / total) * 1000) / 10;
  }
  return { label, points, percent };
}

export interface WuxingEnergyInput {
  pillars: PillarsLike | undefined;
  judge?: string;
  /** 大运干支(缺省则只有原局层) */
  dayunGz?: string;
  /** 流年干支(缺省则无流年层) */
  liunianGz?: string;
}

export function buildWuxingEnergy(input: WuxingEnergyInput): WuxingEnergyData | null {
  const p = input.pillars;
  const dayGan = p?.day?.gan;
  if (!dayGan) return null;
  const dayWx = getGanWuXing(dayGan);
  if (!dayWx) return null;

  const groupOf: Record<string, string> = {};
  for (const w of WX_ALL) {
    groupOf[w] =
      w === dayWx ? '比劫' : SHENG[w] === dayWx ? '印枭' : SHENG[dayWx] === w ? '食伤' : KE[dayWx] === w ? '财才' : '官杀';
  }

  const acc: Record<string, number> = {};
  for (const k of ['year', 'month', 'day', 'time'] as const) pillarPoints(p[k], acc);
  const layers: WuxingEnergyLayer[] = [toLayer('原局', { ...acc })];

  const dy = input.dayunGz;
  if (dy && dy.length >= 2) {
    pillarPoints({ gan: dy[0], zhi: dy[1] }, acc);
    layers.push(toLayer(`+大运${dy}`, { ...acc }));
    const ln = input.liunianGz;
    if (ln && ln.length >= 2) {
      pillarPoints({ gan: ln[0], zhi: ln[1] }, acc);
      layers.push(toLayer(`+流年${ln}`, { ...acc }));
    }
  }

  const likes = likeElements(dayWx, input.judge);
  return {
    method: '干支计点:干100/支藏干100(单藏100、双藏70·30、三藏60·30·10),岁运各计一柱;为结构占比,与引擎旺衰加权(wuXingPower)口径不同',
    dayGan,
    dayWx,
    groupOf,
    ...(likes ? { likes: [...likes] } : {}),
    layers,
  };
}
