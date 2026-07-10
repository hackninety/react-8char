// 《子平真诠》八格原文懒加载:格局判定(geju.ts)命中何格,即可引用该格「论X + 论X取运」原文。
//
// 动机:格局派分析的方法论出自子平真诠,但 AI 手边没有原文,论成败救应时只能凭记忆背书——
// 记混章句是幻觉源。随盘附上本格原文后,AI 从「回忆经文」变成「引用经文再推演」。
// 数据由 scripts/fetch-zipingzhenquan.mjs 双源交叉验证生成(archive.org 公版书 × 殆知阁),
// 约 24KB 独立 chunk,与穷通宝鉴同策略:App 挂载预载、MCP 启动 await、未载入时返回 null。

import type { ZpzqChapter } from './data/zipingzhenquan';

let ZQ_CACHE: Record<string, ZpzqChapter> | null = null;
let ZQ_PROMISE: Promise<void> | null = null;

/** 预载原文库(幂等,可重复调用) */
export function preloadZiping(): Promise<void> {
  if (!ZQ_PROMISE) {
    ZQ_PROMISE = import('./data/zipingzhenquan').then((m) => {
      ZQ_CACHE = m.ZIPING_ZHENQUAN;
    });
  }
  return ZQ_PROMISE;
}

export function isZipingLoaded(): boolean {
  return ZQ_CACHE !== null;
}

/**
 * 取格结果(geju.ge,如「七杀格」「建禄用正官（变通）」)→ 子平真诠章节键。
 * 七杀→偏官、正/偏财→财、正/偏印→印绶、阳刃→阳刃、建禄/月劫(含变通)→建禄月劫。
 */
export function geToChapterKey(ge: string): string | null {
  if (ge.startsWith('阳刃')) return '阳刃';
  if (ge.startsWith('建禄') || ge.startsWith('月劫')) return '建禄月劫';
  if (ge.includes('七杀')) return '偏官';
  if (ge.includes('正财') || ge.includes('偏财')) return '财';
  if (ge.includes('正印') || ge.includes('偏印')) return '印绶';
  if (ge.includes('正官')) return '正官';
  if (ge.includes('食神')) return '食神';
  if (ge.includes('伤官')) return '伤官';
  return null;
}

export interface ZpzqClassic extends ZpzqChapter {
  /** 章节名,如「论偏官」 */
  chapter: string;
  source: string;
}

/** 查本格对应的子平真诠原文(未 preload 时返回 null) */
export function getZipingClassic(ge: string): ZpzqClassic | null {
  if (!ZQ_CACHE) return null;
  const key = geToChapterKey(ge);
  if (!key) return null;
  const c = ZQ_CACHE[key];
  if (!c) return null;
  return { ...c, chapter: `论${key}`, source: '《子平真诠》(沈孝瞻)' };
}

/** 全库(MCP 静态资源用;未 preload 时返回 null) */
export function getZipingAll(): Record<string, ZpzqChapter> | null {
  return ZQ_CACHE;
}
