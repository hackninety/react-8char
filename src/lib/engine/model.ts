// 统一命盘模型：以 mystilight 的 EightCharJSON 为基线（渐进式重构，UI 组件不变），
// 引擎特有的分析块（五行力量/渊海/命理/神煞/干支关系）降级为可选字段，
// 由各引擎适配器按自身能力填充。
import type { EightCharJSON } from './mystilight/upstream';
import type { EngineId } from './types';

export interface EngineMeta {
  id: EngineId;
  name: string;
  school: string;
}

/** 引擎无关的统一命盘（EightCharJSON 的可选化超集 + 引擎元数据） */
export type UnifiedBaziChart = Omit<
  EightCharJSON,
  'wuXingPower' | 'analysis' | 'yuanHaiZiping' | 'meta'
> & {
  wuXingPower?: EightCharJSON['wuXingPower'];
  analysis?: EightCharJSON['analysis'];
  yuanHaiZiping?: EightCharJSON['yuanHaiZiping'];
  /** 神煞（上游未类型化，按引擎能力提供） */
  shensha?: unknown;
  /** 上游引擎自带 meta（耗时等），可选透传 */
  meta?: EightCharJSON['meta'];
  /** 产出本盘的引擎 */
  engine: EngineMeta;
};
