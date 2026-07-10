import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const WU_XING_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  '木': { bg: 'bg-green-500/20', text: 'text-green-600 dark:text-green-400', ring: 'ring-green-500/30' },
  '火': { bg: 'bg-red-500/20', text: 'text-red-600 dark:text-red-400', ring: 'ring-red-500/30' },
  '土': { bg: 'bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-400', ring: 'ring-yellow-500/30' },
  '金': { bg: 'bg-zinc-300/30 dark:bg-zinc-500/20', text: 'text-zinc-600 dark:text-zinc-300', ring: 'ring-zinc-400/30' },
  '水': { bg: 'bg-blue-500/20', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-500/30' },
};

export const WU_XING_BAR_COLORS: Record<string, string> = {
  '木': '#22c55e',
  '火': '#ef4444',
  '土': '#eab308',
  '金': '#a1a1aa',
  '水': '#3b82f6',
};

export const TIAN_GAN_WU_XING: Record<string, string> = {
  '甲': '木', '乙': '木',
  '丙': '火', '丁': '火',
  '戊': '土', '己': '土',
  '庚': '金', '辛': '金',
  '壬': '水', '癸': '水',
};

export const DI_ZHI_WU_XING: Record<string, string> = {
  '子': '水', '丑': '土', '寅': '木', '卯': '木',
  '辰': '土', '巳': '火', '午': '火', '未': '土',
  '申': '金', '酉': '金', '戌': '土', '亥': '水',
};

export function getGanWuXing(gan: string): string {
  return TIAN_GAN_WU_XING[gan] || '';
}

export function getZhiWuXing(zhi: string): string {
  return DI_ZHI_WU_XING[zhi] || '';
}

// 地支本气干（原 lifekline/mcp-format 各有一份，统一于此）
export const ZHI_MAIN_GAN: Record<string, string> = {
  子: '癸', 丑: '己', 寅: '甲', 卯: '乙', 辰: '戊', 巳: '丙',
  午: '丁', 未: '己', 申: '庚', 酉: '辛', 戌: '戊', 亥: '壬',
};

// ─── 十二长生（地势）：阳干顺行、阴干逆行 ─────────────────
const DI_ZHI_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const CHANG_SHENG_ORDER = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const CHANG_SHENG_START: Record<string, string> = {
  甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申',
  乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯',
};
const YANG_GAN = new Set(['甲', '丙', '戊', '庚', '壬']);

/** 某天干在某地支的十二长生阶段（如 甲@亥=长生、辛@酉=临官）；入参非法返回空串 */
export function getDiShi(gan: string, zhi: string): string {
  const start = CHANG_SHENG_START[gan];
  const zi = DI_ZHI_ORDER.indexOf(zhi);
  if (!start || zi < 0) return '';
  const si = DI_ZHI_ORDER.indexOf(start);
  const step = YANG_GAN.has(gan) ? (zi - si + 12) % 12 : (si - zi + 12) % 12;
  return CHANG_SHENG_ORDER[step];
}

export const SHI_SHEN_COLORS: Record<string, string> = {
  '正财': 'bg-yellow-600/20 text-yellow-700 dark:text-yellow-300',
  '偏财': 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  '正官': 'bg-blue-600/20 text-blue-700 dark:text-blue-300',
  '七杀': 'bg-purple-600/20 text-purple-700 dark:text-purple-300',
  '正印': 'bg-green-600/20 text-green-700 dark:text-green-300',
  '偏印': 'bg-teal-600/20 text-teal-700 dark:text-teal-300',
  '比肩': 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-300',
  '劫财': 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  '食神': 'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  '伤官': 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
  '财': 'bg-yellow-600/20 text-yellow-700 dark:text-yellow-300',
  '才': 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  '官': 'bg-blue-600/20 text-blue-700 dark:text-blue-300',
  '杀': 'bg-purple-600/20 text-purple-700 dark:text-purple-300',
  '印': 'bg-green-600/20 text-green-700 dark:text-green-300',
  '枭': 'bg-teal-600/20 text-teal-700 dark:text-teal-300',
  '比': 'bg-zinc-500/20 text-zinc-700 dark:text-zinc-300',
  '劫': 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  '食': 'bg-pink-500/20 text-pink-700 dark:text-pink-300',
  '伤': 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
};

export function getShiShenColor(shiShen: string): string {
  return SHI_SHEN_COLORS[shiShen] || 'bg-muted text-muted-foreground';
}
