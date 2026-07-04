// 引擎抽象：插件式多引擎的公共接口定义
import type { BaziInput } from '../bazi';
import type { UnifiedBaziChart } from './model';

export type EngineId = 'mystilight' | 'tyme';

/** 引擎能力描述：UI 按能力显隐对应卡片/功能 */
export interface EngineCapabilities {
  /** 五行力量数值 */
  wuXingPower: boolean;
  /** 神煞系统 */
  shensha: boolean;
  /** 渊海子平分析（身强/湿度/月令/太岁） */
  yuanHaiZiping: boolean;
  /** 命理分析（喜用神/日时/三命通会） */
  analysis: boolean;
  /** 干支关系（合冲刑害） */
  ganZhiRelations: boolean;
  /** 流月/流日/流时 五级联动 */
  liuYue: boolean;
  liuRi: boolean;
  liuShi: boolean;
  /** 八字反查 */
  reverseLookup: boolean;
  /** 小运 */
  xiaoYun: boolean;
  /** 童限（起运精确到天时） */
  childLimit: boolean;
}

export interface EngineDescriptor {
  id: EngineId;
  /** 展示名，如「渊海子平（mystilight）」 */
  name: string;
  /** 体系/流派，如「渊海子平」「6tail 干支历」 */
  school: string;
  /** 一句话说明（UI 提示用） */
  summary: string;
  capabilities: EngineCapabilities;
}

export interface BaziEngine extends EngineDescriptor {
  calculate(input: BaziInput): UnifiedBaziChart;
}
