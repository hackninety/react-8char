// 本地持久化：只存「起盘参数」（BaziInput），刷新时据此重算命盘——不存渲染结果，
// 既省空间又无陈旧之虞（重算总是走最新排盘逻辑）。表单字段另存快照用于输入框回填。
import type { BaziInput } from './bazi';

// 版本号：参数结构不兼容变更时递增，旧数据自动失效
const KEY = 'react-8char:params:v1';

/** 存起盘参数（一次成功排盘的 BaziInput） */
export function saveParams(input: BaziInput): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(input));
  } catch {
    /* 隐私模式/超配额等，静默忽略 */
  }
}

/** 读上次起盘参数；无或损坏返回 null */
export function loadParams(): BaziInput | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && typeof data.year === 'number') {
      return data as BaziInput;
    }
  } catch {
    /* 解析失败当作无缓存 */
  }
  return null;
}

export function clearParams(): void {
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
  name: string; livingPlace: string; userNote: string;
  yearGan: string; yearZhi: string; monthGan: string; monthZhi: string;
  dayGan: string; dayZhi: string; timeGan: string; timeZhi: string;
}

export function saveForm(snap: FormSnapshot | Partial<FormSnapshot>): void {
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

// ─── 多命盘档案（命名保存的起盘参数 + 表单快照）────────
// 与单槽持久化同哲学：只存参数、载入时重算；表单快照用于回填输入框。

const PROFILES_KEY = 'react-8char:profiles:v1';
const PROFILES_MAX = 50;

export interface ChartProfile {
  id: string;
  /** 档案名（如人名） */
  name: string;
  /** ISO 时间 */
  savedAt: string;
  /** 起盘参数（据此重算命盘/合婚） */
  input: BaziInput;
  /** 表单快照（载入时回填输入框） */
  form?: Partial<FormSnapshot>;
}

export function listProfiles(): ChartProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((p) => p && typeof p === 'object' && p.id && p.input);
  } catch {
    /* ignore */
  }
  return [];
}

function writeProfiles(list: ChartProfile[]): void {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(list.slice(0, PROFILES_MAX)));
  } catch {
    /* ignore */
  }
}

/** 保存档案（同名覆盖，新档案排最前） */
export function saveProfile(name: string, input: BaziInput, form?: Partial<FormSnapshot> | null): ChartProfile {
  const profile: ChartProfile = {
    id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim(),
    savedAt: new Date().toISOString(),
    input,
    ...(form ? { form } : {}),
  };
  const rest = listProfiles().filter((p) => p.name !== profile.name);
  writeProfiles([profile, ...rest]);
  return profile;
}

export function deleteProfile(id: string): void {
  writeProfiles(listProfiles().filter((p) => p.id !== id));
}
