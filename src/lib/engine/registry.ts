// 引擎注册表：按 id 惰性加载（动态 import 分包），描述信息静态可用（供表单渲染选项）
import type { BaziEngine, EngineDescriptor, EngineId, EngineCapabilities } from './types';

const ALL_ON: EngineCapabilities = {
  wuXingPower: true, shensha: true, yuanHaiZiping: true, analysis: true,
  ganZhiRelations: true, liuYue: true, liuRi: true, liuShi: true,
  reverseLookup: true, xiaoYun: true, childLimit: false,
};

interface EngineEntry {
  descriptor: EngineDescriptor;
  load: () => Promise<BaziEngine>;
}

const ENTRIES: Record<EngineId, EngineEntry> = {
  mystilight: {
    descriptor: {
      id: 'mystilight',
      name: '渊海子平（mystilight）',
      school: '渊海子平',
      summary: '按渊海子平原文实现，含完整神煞与身强/湿度/月令/太岁分析',
      capabilities: ALL_ON,
    },
    load: () => import('./mystilight/adapter').then((m) => m.engine),
  },
  tyme: {
    descriptor: {
      id: 'tyme',
      name: '干支历标准（tyme4ts）',
      school: '6tail 干支历',
      summary: '6tail 新一代标准算法，支持多种起运流派与童限，适合对拍校验',
      capabilities: {
        wuXingPower: false, shensha: true, yuanHaiZiping: false, analysis: false,
        ganZhiRelations: false, liuYue: true, liuRi: true, liuShi: true,
        reverseLookup: true, xiaoYun: true, childLimit: true,
      },
    },
    load: () => import('./tyme/adapter').then((m) => m.engine),
  },
};

const cache = new Map<EngineId, Promise<BaziEngine>>();

export const DEFAULT_ENGINE: EngineId = 'mystilight';

export function listEngines(): EngineDescriptor[] {
  return Object.values(ENTRIES).map((e) => e.descriptor);
}

export function getEngineDescriptor(id: EngineId): EngineDescriptor {
  return ENTRIES[id].descriptor;
}

export function loadEngine(id: EngineId): Promise<BaziEngine> {
  let p = cache.get(id);
  if (!p) {
    p = ENTRIES[id].load();
    cache.set(id, p);
  }
  return p;
}
