// mystilight 引擎适配器：现有 calculateBazi 的近似透传（它本就输出统一模型的基线形状）
import { calculateBazi } from '../../bazi';
import type { BaziInput } from '../../bazi';
import type { BaziEngine } from '../types';
import type { UnifiedBaziChart } from '../model';
import { getEngineDescriptor } from '../registry';

const descriptor = getEngineDescriptor('mystilight');

export const engine: BaziEngine = {
  ...descriptor,
  calculate(input: BaziInput): UnifiedBaziChart {
    const r = calculateBazi(input);
    return {
      ...r,
      shensha: (r as { shensha?: unknown }).shensha,
      engine: { id: descriptor.id, name: descriptor.name, school: descriptor.school },
    };
  },
};
