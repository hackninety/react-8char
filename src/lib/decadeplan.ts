// 十年规划表:一运一行的人生总览——干支十神 + 十二长生 + 扶抑喜忌 + K线均值/高光/低谷年
// + 该运岁运格局扫描;行可展开逐年明细。盘面组件与 AI 导出共用同一构建(参 react-zwds DecadePlan)。
import type { BaziResult, BaziResultX } from './bazi';
import { buildLifeKline, type LifeKlineData } from './lifekline';
import { detectYunPatterns, likeElements, type YunPatternHit } from './yunpatterns';
import { getGanWuXing, getZhiWuXing, getDiShi, SHI_SHEN_FULL } from './utils';

export interface DecadeYearMark {
  year: number;
  ganZhi: string;
  score: number;
}

export interface DecadePlanYearDetail {
  year: number;
  ganZhi: string;
  age: number;
  score: number;
  delta: number;
  /** 该年总运维度前两条评分因素 */
  topFactors: string[];
}

export interface DecadePlanRow {
  ganZhi: string;
  startYear: number;
  endYear: number;
  startAge: number;
  endAge: number;
  /** 运干/运支十神 */
  ganShen: string;
  zhiShen: string;
  /** 日主在运支的十二长生 */
  diShi: string;
  /** 扶抑口径喜忌:喜 / 忌 / 干喜支忌 / 干忌支喜;身强弱未判或中和为 — */
  favor: string;
  /** K线总运均值(超出K线范围的运为 null) */
  avg: number | null;
  best: DecadeYearMark | null;
  worst: DecadeYearMark | null;
  current: boolean;
  /** 该运岁运格局扫描(大运 scope) */
  patterns: YunPatternHit[];
  /** 逐年明细(展开用;超出K线范围为空) */
  years: DecadePlanYearDetail[];
}

export interface DecadePlanData {
  judge: string;
  rows: DecadePlanRow[];
  note: string;
}

/** 扶抑口径的大运干支喜忌标注 */
function favorOf(gz: string, dayWx: string, judge?: string): string {
  const likes = likeElements(dayWx, judge);
  if (!likes) return '—';
  const g = likes.has(getGanWuXing(gz[0]));
  const z = likes.has(getZhiWuXing(gz[1]));
  if (g && z) return '喜';
  if (!g && !z) return '忌';
  return g ? '干喜支忌' : '干忌支喜';
}

export function buildDecadePlan(result: BaziResult, kline?: LifeKlineData | null): DecadePlanData | null {
  const pillars = result.pillars;
  const dayGan = pillars?.dayMasterGan || pillars?.day?.gan;
  if (!dayGan || !Array.isArray(result.dayunArr)) return null;
  const k = kline === undefined ? buildLifeKline(result) : kline;
  const judge = k?.judge ?? '';
  const dayWx = getGanWuXing(dayGan);
  const birthYear = result.input.year;

  const cur = (result as BaziResultX & { currentYun?: { daYun?: { ganZhi?: string | string[] } } }).currentYun;
  const curGz = cur?.daYun?.ganZhi ? (Array.isArray(cur.daYun.ganZhi) ? cur.daYun.ganZhi.join('') : cur.daYun.ganZhi) : '';

  const rows: DecadePlanRow[] = [];
  for (const dy of result.dayunArr) {
    if (!dy.ganZhi || typeof dy.ganZhi !== 'string' || dy.ganZhi.length < 2 || !dy.liunianArr?.length) continue;
    const startYear = dy.startYear ?? dy.liunianArr[0].year;
    const endYear = dy.liunianArr[dy.liunianArr.length - 1].year;

    const pts = (k?.years ?? []).filter((y) => y.dayun === dy.ganZhi && y.year >= startYear);
    const sorted = [...pts].sort((a, b) => b.scores.total - a.scores.total);
    const mark = (y: (typeof pts)[number] | undefined): DecadeYearMark | null =>
      y ? { year: y.year, ganZhi: y.ganZhi, score: y.scores.total } : null;
    const avgEntry = k?.decades.find((d) => d.ganZhi === dy.ganZhi && d.startYear >= startYear - 1);

    rows.push({
      ganZhi: dy.ganZhi,
      startYear,
      endYear,
      startAge: startYear - birthYear + 1,
      endAge: endYear - birthYear + 1,
      ganShen: SHI_SHEN_FULL[dy.ganshen ?? ''] ?? dy.ganshen ?? '',
      zhiShen: SHI_SHEN_FULL[dy.zhishen ?? ''] ?? dy.zhishen ?? '',
      diShi: getDiShi(dayGan, dy.ganZhi[1]),
      favor: favorOf(dy.ganZhi, dayWx, judge),
      avg: avgEntry?.avg.total ?? (pts.length ? Math.round(pts.reduce((s, y) => s + y.scores.total, 0) / pts.length) : null),
      best: mark(sorted[0]),
      worst: mark(sorted[sorted.length - 1]),
      current: !!curGz && dy.ganZhi === curGz,
      patterns: detectYunPatterns({ pillars, judge, gender: result.gender, dayunGz: dy.ganZhi }),
      years: pts.map((y) => ({
        year: y.year,
        ganZhi: y.ganZhi,
        age: y.age,
        score: y.scores.total,
        delta: y.delta.total,
        topFactors: y.factors.total.slice(0, 2),
      })),
    });
  }
  if (!rows.length) return null;

  return {
    judge,
    rows,
    note: '均值/高光/低谷取人生K线总运维;喜忌为扶抑口径(身强弱定);运限格局为该运与原局的确定性扫描,轻重成败须结合全局细辨',
  };
}
