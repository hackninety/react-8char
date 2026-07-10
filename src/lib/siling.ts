// 人元司令分野：按出生距月初之「节」的天数，定出生时月令中何干司令（用事）。
//
// 动机：司令之干影响格局取用与旺衰精细判断（如同生寅月，戊土司令与甲木司令迥异），
// 是 AI 凭记忆极易算错的项——须精确节气时刻与分日表。此处确定性算好随盘导出。
//
// 分日表源：《渊海子平》《三命通会》通行「月令分日用事」版（申/亥月各本略有出入，取流传最广者）。
// 时间基准：与五运六气模块一致，用标准时（北京时）与天文节气时刻比较；
// 国外命例由 utcOffset 换算为北京时后再比。真太阳时校正不参与（节气时刻本即标准时）。

import { Solar } from 'lunar-javascript';
import { getShiShen } from './engine/mystilight/ext/shishen';
import { getGanWuXing } from './utils';

const JIE_TO_ZHI: Record<string, string> = {
  立春: '寅', 惊蛰: '卯', 清明: '辰', 立夏: '巳', 芒种: '午', 小暑: '未',
  立秋: '申', 白露: '酉', 寒露: '戌', 立冬: '亥', 大雪: '子', 小寒: '丑',
};

// 月支 → [司令干, 天数] 序列（依节后第几日顺次用事，合计 30 日）
const SILING_TABLE: Record<string, [string, number][]> = {
  寅: [['戊', 7], ['丙', 7], ['甲', 16]],
  卯: [['甲', 10], ['乙', 20]],
  辰: [['乙', 9], ['癸', 3], ['戊', 18]],
  巳: [['戊', 5], ['庚', 9], ['丙', 16]],
  午: [['丙', 10], ['己', 9], ['丁', 11]],
  未: [['丁', 9], ['乙', 3], ['己', 18]],
  申: [['戊', 10], ['壬', 3], ['庚', 17]],
  酉: [['庚', 10], ['辛', 20]],
  戌: [['辛', 9], ['丁', 3], ['戊', 18]],
  亥: [['戊', 7], ['甲', 5], ['壬', 18]],
  子: [['壬', 10], ['癸', 20]],
  丑: [['癸', 9], ['辛', 3], ['己', 18]],
};

export interface SiLingResult {
  /** 所值之节，如「立春」 */
  jie: string;
  /** 该节对应月支 */
  monthZhi: string;
  /** 节交司时刻（北京时），如「2月4日 10:42」 */
  jieTime: string;
  /** 生于节后第几日（1 起） */
  dayN: number;
  /** 司令天干 */
  gan: string;
  /** 司令干五行 */
  wuXing: string;
  /** 司令干相对日主的十神 */
  shiShen: string;
  /** 一句话，如「生于立春后第 6 日，戊土司令（第 1~7 日戊土用事）」 */
  phase: string;
  /** 全月分野序列，如「寅月分野：戊7日→丙7日→甲16日」 */
  sequence: string;
  /** 与命盘月支不一致等注意事项 */
  note?: string;
}

interface SiLingInput {
  year: number; month: number; day: number;
  hour?: number; minute?: number;
  /** 出生地时区 UTC 偏移（小时），缺省 8（北京时） */
  utcOffset?: number;
}

// 统一用「墙上时刻 → Date.UTC」做比较，规避机器时区/DST 影响
const wallUTC = (y: number, mo: number, d: number, h: number, mi: number) => Date.UTC(y, mo - 1, d, h, mi);

/** 收集 year-1 与 year 两个节气表中的 12 节，按时刻排序（覆盖年初生于上年节内的情形） */
function collectJie(year: number): { name: string; ms: number }[] {
  const out: { name: string; ms: number }[] = [];
  const seen = new Set<number>();
  for (const y of [year - 1, year]) {
    const table = Solar.fromYmd(y, 6, 1).getLunar().getJieQiTable();
    for (const key of Object.keys(table)) {
      if (!JIE_TO_ZHI[key]) continue;
      const v = table[key];
      if (!v || typeof v.getYear !== 'function') continue;
      const ms = wallUTC(v.getYear(), v.getMonth(), v.getDay(), v.getHour?.() ?? 0, v.getMinute?.() ?? 0);
      if (seen.has(ms)) continue;
      seen.add(ms);
      out.push({ name: key, ms });
    }
  }
  return out.sort((a, b) => a.ms - b.ms);
}

/**
 * 计算出生时刻的人元司令。
 * @param dayGan 日主天干（算司令干十神用）
 * @param chartMonthZhi 命盘月支（校验一致性；真太阳时校正跨节时会不一致，出注说明）
 */
export function computeSiLing(input: SiLingInput, dayGan: string, chartMonthZhi?: string): SiLingResult | null {
  try {
    const utcOffset = input.utcOffset ?? 8;
    // 出生标准时 → 北京墙上时刻
    const birthMs = wallUTC(input.year, input.month, input.day, input.hour ?? 0, input.minute ?? 0)
      - (utcOffset - 8) * 3_600_000;

    const jies = collectJie(input.year);
    let cur: { name: string; ms: number } | null = null;
    for (const j of jies) {
      if (j.ms <= birthMs) cur = j;
      else break;
    }
    if (!cur) return null;

    const zhi = JIE_TO_ZHI[cur.name];
    const seq = SILING_TABLE[zhi];
    const daysInto = (birthMs - cur.ms) / 86_400_000;
    const dayN = Math.floor(daysInto) + 1;

    // 走分日表定司令；超出表定 30 日（月长于 30 日）仍以末段本气续司
    let acc = 0;
    let gan = seq[seq.length - 1][0];
    let range = '';
    for (const [g, days] of seq) {
      if (dayN <= acc + days) {
        gan = g;
        range = `第 ${acc + 1}~${acc + days} 日${g}${getGanWuXing(g)}用事`;
        break;
      }
      acc += days;
    }
    if (!range) range = `已过表定 30 日，仍以本气${gan}${getGanWuXing(gan)}续司`;

    const jieDate = new Date(cur.ms);
    const jieTime = `${jieDate.getUTCMonth() + 1}月${jieDate.getUTCDate()}日 ${String(jieDate.getUTCHours()).padStart(2, '0')}:${String(jieDate.getUTCMinutes()).padStart(2, '0')}`;

    const notes: string[] = [];
    if (chartMonthZhi && chartMonthZhi !== zhi) {
      notes.push(`按天文节气所值为${zhi}月，与命盘月支${chartMonthZhi}不一致（多因真太阳时校正跨节或流派口径），司令以天文节气为准`);
    }
    if (dayN <= 1 || daysInto >= sumDays(seq) - 1) {
      notes.push('生于分野交界附近，司令归属对时刻敏感，宜两说并参');
    }

    return {
      jie: cur.name,
      monthZhi: zhi,
      jieTime,
      dayN,
      gan,
      wuXing: getGanWuXing(gan),
      shiShen: getShiShen(dayGan, gan) || '',
      phase: `生于${cur.name}后第 ${dayN} 日，${gan}${getGanWuXing(gan)}司令（${range}）`,
      sequence: `${zhi}月分野：${seq.map(([g, d]) => `${g}${d}日`).join('→')}`,
      ...(notes.length ? { note: notes.join('；') } : {}),
    };
  } catch {
    return null;
  }
}

function sumDays(seq: [string, number][]): number {
  return seq.reduce((s, [, d]) => s + d, 0);
}
