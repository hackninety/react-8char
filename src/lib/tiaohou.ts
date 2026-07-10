// 调候用神（穷通宝鉴）：120 条「日主 × 月支」用神查表 + 原局得否确定性判定。
//
// 动机：AI 提示词中的调候派视角要求「按日主×月支查穷通宝鉴」，但盘面数据里没有这张表，
// 等于让 AI 闭卷回忆——记错用神是常见幻觉源。查表后随盘导出「本造调候用神 + 原局透藏情况」，
// 调候派分析即从回忆变成引用与推演。
//
// 表源：《穷通宝鉴》（徐乐吾《造化元钥》整理本）通行调候用神简表。
// 各刊本首位用神一致；佐神取舍与次序间有异文，本表取流传最广版本。首字为主用，余为佐。

import type { QtbjEntry } from './data/qiongtongbaojian';

// ─── 穷通宝鉴原文库懒加载（约 100KB，已从首屏主包拆出为独立 chunk）─────
// App 挂载即预载、MCP 启动时 await；未载入时 getQiongTongText 返回 null（classic 字段暂缺）。

let QT_CACHE: Record<string, Record<string, QtbjEntry>> | null = null;
let QT_PROMISE: Promise<void> | null = null;

/** 预载原文库（幂等，可重复调用） */
export function preloadQiongTong(): Promise<void> {
  if (!QT_PROMISE) {
    QT_PROMISE = import('./data/qiongtongbaojian').then((m) => {
      QT_CACHE = m.QIONG_TONG_TEXT;
    });
  }
  return QT_PROMISE;
}

export function isQiongTongLoaded(): boolean {
  return QT_CACHE !== null;
}

type GZ = { gan: string; zhi: string; hideGanAttr?: { gan: string; qiLevel: string }[] };
type PillarsLike = { year: GZ; month: GZ; day: GZ; time: GZ };

const TABLE: Record<string, Record<string, string>> = {
  甲: { 寅: '丙癸', 卯: '庚丙丁戊己', 辰: '庚丁壬', 巳: '癸丁庚', 午: '癸庚丁', 未: '癸丁庚', 申: '庚丁壬', 酉: '庚丁丙', 戌: '庚甲丁壬癸', 亥: '庚丁丙戊', 子: '丁庚丙', 丑: '丁庚丙' },
  乙: { 寅: '丙癸', 卯: '丙癸', 辰: '癸丙戊', 巳: '癸', 午: '癸丙', 未: '癸丙', 申: '丙癸己', 酉: '癸丙丁', 戌: '癸辛', 亥: '丙戊', 子: '丙', 丑: '丙' },
  丙: { 寅: '壬庚', 卯: '壬己', 辰: '壬甲', 巳: '壬庚癸', 午: '壬庚', 未: '壬庚', 申: '壬戊', 酉: '壬癸', 戌: '甲壬', 亥: '甲戊庚壬', 子: '壬戊己', 丑: '壬甲' },
  丁: { 寅: '甲庚', 卯: '庚甲', 辰: '甲庚', 巳: '甲庚', 午: '壬庚癸', 未: '甲壬庚', 申: '甲庚丙戊', 酉: '甲庚丙戊', 戌: '甲庚戊', 亥: '甲庚', 子: '甲庚', 丑: '甲庚' },
  戊: { 寅: '丙甲癸', 卯: '丙甲癸', 辰: '甲丙癸', 巳: '甲丙癸', 午: '壬甲丙', 未: '癸丙甲', 申: '丙癸甲', 酉: '丙癸', 戌: '甲丙癸', 亥: '甲丙', 子: '丙甲', 丑: '丙甲' },
  己: { 寅: '丙庚甲', 卯: '甲癸丙', 辰: '丙癸甲', 巳: '癸丙', 午: '癸丙', 未: '癸丙', 申: '丙癸', 酉: '丙癸', 戌: '甲丙癸', 亥: '丙甲戊', 子: '丙甲戊', 丑: '丙甲戊' },
  庚: { 寅: '戊甲壬丙丁', 卯: '丁甲庚丙', 辰: '甲丁壬癸', 巳: '壬戊丙丁', 午: '壬癸', 未: '丁甲', 申: '丁甲', 酉: '丁甲丙', 戌: '甲壬', 亥: '丁丙', 子: '丁甲丙', 丑: '丙丁甲' },
  辛: { 寅: '己壬庚', 卯: '壬甲', 辰: '壬甲', 巳: '壬甲癸', 午: '壬己癸', 未: '壬庚甲', 申: '壬甲戊', 酉: '壬甲', 戌: '壬甲', 亥: '壬丙', 子: '丙戊壬甲', 丑: '丙壬戊己' },
  壬: { 寅: '庚丙戊', 卯: '戊辛庚', 辰: '甲庚', 巳: '壬辛庚癸', 午: '癸庚辛', 未: '辛甲', 申: '戊丁', 酉: '甲庚', 戌: '甲丙', 亥: '戊丙庚', 子: '戊丙', 丑: '丙丁甲' },
  癸: { 寅: '辛丙', 卯: '庚辛', 辰: '丙辛甲', 巳: '辛', 午: '庚辛壬癸', 未: '庚辛壬癸', 申: '丁', 酉: '辛丙', 戌: '辛甲壬癸', 亥: '庚辛戊丁', 子: '丙辛', 丑: '丙丁' },
};

export interface TiaoHouGodStatus {
  gan: string;
  role: '主' | '佐';
  /** 得否描述：透于X干 / 藏于X支(气级) / 原局不见 */
  status: string;
  /** 2=透干 1=仅藏支 0=原局不见 */
  strength: 0 | 1 | 2;
}

export interface TiaoHouResult {
  dayGan: string;
  monthZhi: string;
  /** 用神序列（主用在前），如 ['丙','癸'] */
  gods: string[];
  detail: TiaoHouGodStatus[];
  /** 一句话结论 */
  verdict: string;
  source: string;
  /** 本造对应的《穷通宝鉴》原文段（仅此一条随盘导出；含粒度标注） */
  classic?: QtbjEntry & { source: string };
}

const PILLAR_CN: Record<string, string> = { year: '年', month: '月', day: '日', time: '时' };

/** 仅查表：日主×月支 → 用神序列（主用在前）；无需完整命盘（MCP 快查等场景用） */
export function getTiaoHouGods(dayGan: string, monthZhi: string): string[] | null {
  const s = TABLE[dayGan]?.[monthZhi];
  return s ? s.split('') : null;
}

/** 查穷通宝鉴调候用神并判定原局得否（确定性，供 AI 引用而非回忆） */
export function analyzeTiaoHou(pillars: PillarsLike | undefined): TiaoHouResult | null {
  const dayGan = pillars?.day?.gan;
  const monthZhi = pillars?.month?.zhi;
  if (!dayGan || !monthZhi) return null;
  const godsStr = TABLE[dayGan]?.[monthZhi];
  if (!godsStr) return null;
  const gods = godsStr.split('');

  const keys = ['year', 'month', 'day', 'time'] as const;
  const detail: TiaoHouGodStatus[] = gods.map((g, i) => {
    const tou: string[] = [];
    const cang: string[] = [];
    for (const k of keys) {
      const p = pillars[k];
      if (k !== 'day' && p.gan === g) tou.push(`${PILLAR_CN[k]}干`);
      for (const hg of p.hideGanAttr ?? []) {
        if (hg.gan === g) cang.push(`${PILLAR_CN[k]}支${p.zhi}(${hg.qiLevel})`);
      }
    }
    const isDayMaster = g === dayGan;
    const parts: string[] = [];
    if (isDayMaster) parts.push('即日主本身（需另见方为得力）');
    if (tou.length) parts.push(`透于${tou.join('、')}`);
    if (cang.length) parts.push(`藏于${cang.join('、')}`);
    const strength: 0 | 1 | 2 = tou.length ? 2 : cang.length ? 1 : 0;
    return {
      gan: g,
      role: i === 0 ? '主' : '佐',
      status: parts.length ? parts.join('，') : '原局不见',
      strength,
    };
  });

  const primary = detail[0];
  const anyAux = detail.slice(1).some((d) => d.strength > 0);
  const verdict =
    primary.strength === 2
      ? `主用神${primary.gan}透干，调候得力`
      : primary.strength === 1
        ? `主用神${primary.gan}藏支不透，调候之力打折，喜运岁引出`
        : anyAux
          ? `主用神${primary.gan}原局不见，赖佐用（${detail.filter((d, i) => i > 0 && d.strength > 0).map((d) => d.gan).join('、')}）勉力代之，行运补${primary.gan}为要`
          : `调候用神原局全不见，格局纵成亦减等，大运补调候（${gods.join('、')}）之时方发`;

  return {
    dayGan,
    monthZhi,
    gods,
    detail,
    verdict,
    source: '穷通宝鉴·通行调候简表（佐神次序各本或有异文）',
    ...(() => {
      const c = getQiongTongText(dayGan, monthZhi);
      return c ? { classic: c } : {};
    })(),
  };
}

/** 查本造《穷通宝鉴》原文段（维基文库公有领域文本；只取一条，token 成本近零）。
 *  依赖懒加载缓存：未 preloadQiongTong 完成前返回 null。 */
export function getQiongTongText(dayGan: string, monthZhi: string): (QtbjEntry & { source: string }) | null {
  const e = QT_CACHE?.[dayGan]?.[monthZhi];
  return e ? { ...e, source: '维基文库《穷通宝鉴》' } : null;
}
