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
