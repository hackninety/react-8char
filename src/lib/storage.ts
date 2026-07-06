// 本地持久化：把最近一次排盘的输入与命盘存入 localStorage，刷新后自动恢复。
// 只存原始命盘对象（体积小、可 JSON 序列化）；人生K线/地利等在组件里由命盘现算，无陈旧之虞。
import type { BaziInput, BaziResult } from './bazi';

// 版本号：命盘结构不兼容变更时递增，旧数据自动失效
const KEY = 'react-8char:lastChart:v1';

export interface StoredChart {
  input: BaziInput;
  result: BaziResult;
}

export function saveChart(input: BaziInput, result: BaziResult): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ input, result, savedAt: Date.now() }));
  } catch {
    /* 隐私模式/超配额等，静默忽略 */
  }
}

export function loadChart(): StoredChart | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && data.input && data.result) {
      return { input: data.input as BaziInput, result: data.result as BaziResult };
    }
  } catch {
    /* 解析失败当作无缓存 */
  }
  return null;
}

export function clearChart(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// ─── 表单快照（回填输入框，刷新不变）──────────────────

const FORM_KEY = 'react-8char:form:v1';

/** 排盘表单的全部可持久字段（排除 lookupResults/lookupError 等瞬时态） */
export interface FormSnapshot {
  mode: string;
  yearStr: string; monthStr: string; dayStr: string; hourStr: string; minuteStr: string;
  isLeapMonth: boolean;
  gender: 0 | 1; sect: 1 | 2;
  engine: string; compareOn: boolean;
  useTrueSolar: boolean;
  locMode: string; manualPlace: string; manualLng: string; manualLat: string; manualTz: string;
  province: string; cityName: string; district: string;
  livingPlace: string; userNote: string;
  yearGan: string; yearZhi: string; monthGan: string; monthZhi: string;
  dayGan: string; dayZhi: string; timeGan: string; timeZhi: string;
}

export function saveForm(snap: FormSnapshot): void {
  try {
    localStorage.setItem(FORM_KEY, JSON.stringify(snap));
  } catch {
    /* ignore */
  }
}

export function loadForm(): Partial<FormSnapshot> | null {
  try {
    const raw = localStorage.getItem(FORM_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object') return data as Partial<FormSnapshot>;
  } catch {
    /* ignore */
  }
  return null;
}
