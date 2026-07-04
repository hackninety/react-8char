// 双引擎对拍：同一命例并行计算，差异分级呈现。
//
// 差异分级（依 P2 实证校准）：
//   hard —— 四柱干支/日主/顺逆/大运干支序列不一致：理论上两家必须相同，
//           出现即提示谨慎参考（通常意味着适配或算法缺陷）。
//   sect —— 起运时刻（进位口径）、大运起始年、命宫/身宫/胎元/胎息（起法口径）：
//           属流派性差异，预期内，供研究参考。
import type { BaziInput } from '../bazi';
import type { UnifiedBaziChart } from './model';
import type { EngineId } from './types';
import { loadEngine, getEngineDescriptor, DEFAULT_ENGINE } from './registry';

export type DiffKind = 'hard' | 'sect';

export interface DiffItem {
  kind: DiffKind;
  /** 差异项名称，如「时柱」「起运时刻」「身宫」 */
  label: string;
  a: string;
  b: string;
}

export interface CompareReport {
  a: { id: EngineId; name: string };
  b: { id: EngineId; name: string };
  items: DiffItem[];
  hardCount: number;
  sectCount: number;
  /** 无硬差异（四柱/大运一致） */
  consistent: boolean;
  /** 完全一致 */
  identical: boolean;
  summary: string;
}

const PILLAR_LABELS: [keyof UnifiedBaziChart['pillars'] & string, string][] = [
  ['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['time', '时柱'],
];

function ganZhiOf(chart: UnifiedBaziChart, key: string): string {
  const p = (chart.pillars as unknown as Record<string, { gan?: string; zhi?: string } | undefined>)[key];
  return p ? `${p.gan ?? ''}${p.zhi ?? ''}` : '';
}

function dayunSeq(chart: UnifiedBaziChart): { ganZhi: string; startYear: number }[] {
  return (chart.dayunArr ?? []).filter((d) => d.ganZhi).slice(0, 10)
    .map((d) => ({ ganZhi: d.ganZhi, startYear: d.startYear }));
}

/** 对比两张命盘，产出差异报告（纯函数，可用于任意两引擎结果） */
export function diffCharts(
  a: UnifiedBaziChart, b: UnifiedBaziChart,
  aMeta: { id: EngineId; name: string }, bMeta: { id: EngineId; name: string },
): CompareReport {
  const items: DiffItem[] = [];
  const push = (kind: DiffKind, label: string, va: string, vb: string) => {
    if (va !== vb) items.push({ kind, label, a: va, b: vb });
  };

  // ── 硬校验：四柱 / 顺逆 / 大运干支序列 ──
  for (const [key, label] of PILLAR_LABELS) {
    push('hard', label, ganZhiOf(a, key), ganZhiOf(b, key));
  }
  push('hard', '排运方向', a.yun?.forward ? '顺排' : '逆排', b.yun?.forward ? '顺排' : '逆排');
  const seqA = dayunSeq(a); const seqB = dayunSeq(b);
  push('hard', '大运干支序列', seqA.map((d) => d.ganZhi).join(' '), seqB.map((d) => d.ganZhi).join(' '));

  // ── 流派性差异：起运 / 大运起始年 / 命盘要素 ──
  push('sect', '起运时刻', a.yun?.startSolar ?? '', b.yun?.startSolar ?? '');
  push('sect', '大运起始年', seqA.map((d) => String(d.startYear)).join(' '), seqB.map((d) => String(d.startYear)).join(' '));
  push('sect', '胎元', a.taiYuan ?? '', b.taiYuan ?? '');
  push('sect', '胎息', a.taiXi ?? '', b.taiXi ?? '');
  push('sect', '命宫', a.mingGong ?? '', b.mingGong ?? '');
  push('sect', '身宫', a.shenGong ?? '', b.shenGong ?? '');

  const hardCount = items.filter((i) => i.kind === 'hard').length;
  const sectCount = items.length - hardCount;
  const identical = items.length === 0;
  const consistent = hardCount === 0;
  const summary = identical
    ? `两引擎（${aMeta.name} × ${bMeta.name}）排盘完全一致`
    : consistent
      ? `核心盘（四柱/大运）一致，${sectCount} 处流派性差异（起运/宫位口径不同，属预期）`
      : `发现 ${hardCount} 处核心差异（另有 ${sectCount} 处流派性差异），请谨慎参考`;

  return { a: aMeta, b: bMeta, items, hardCount, sectCount, consistent, identical, summary };
}

/** 用两个引擎并行排同一命例并对拍 */
export async function compareEngines(
  input: BaziInput,
  aId: EngineId = DEFAULT_ENGINE,
  bId: EngineId = 'tyme',
): Promise<CompareReport> {
  const [ea, eb] = await Promise.all([loadEngine(aId), loadEngine(bId)]);
  const ca = ea.calculate(input);
  const cb = eb.calculate(input);
  const da = getEngineDescriptor(aId); const db = getEngineDescriptor(bId);
  return diffCharts(ca, cb, { id: aId, name: da.name }, { id: bId, name: db.name });
}
