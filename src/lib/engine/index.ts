// 引擎层门面：统一入口
import type { BaziInput } from '../bazi';
import type { EngineId } from './types';
import type { UnifiedBaziChart } from './model';
import { DEFAULT_ENGINE, loadEngine } from './registry';

export type { EngineId, EngineDescriptor, EngineCapabilities, BaziEngine } from './types';
export type { UnifiedBaziChart, EngineMeta } from './model';
export { listEngines, getEngineDescriptor, loadEngine, DEFAULT_ENGINE } from './registry';
export { compareEngines, diffCharts } from './compare';
export type { CompareReport, DiffItem, DiffKind } from './compare';

/** 用指定引擎排盘（引擎代码按需懒加载） */
export async function calculateChart(
  input: BaziInput,
  engineId: EngineId = DEFAULT_ENGINE,
): Promise<UnifiedBaziChart> {
  const engine = await loadEngine(engineId);
  return engine.calculate(input);
}
