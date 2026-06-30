// 五运六气（Wǔ Yùn Liù Qì · Five Movements & Six Qi）
// 依据《黄帝内经·素问》运气七篇，由年干支推演当年运气格局，并按交司时刻
// 定位出生时所值之运步、气步。
//
// 交司时刻约定（现代定气法）：
//   · 气步（主气/客气六步）以真实「中气」天文时刻为界：大寒/春分/小满/大暑/
//     秋分/小雪（经 lunar-javascript 精确到分）。
//   · 运步（主运/客运五步）起于大寒，每步 73.05 日（365.25÷5）等分。
//   · 运气年以「大寒」交司时刻为岁首（非元旦、非立春）；判断跨界精确到时/分。
//   · 比较基准统一用标准时（北京时，120°E）——节气时刻本即北京时；出生时刻
//     须用标准时（非真太阳时）参与比较，切勿混用。
//
// 节气数据不可得时，优雅降级：仅展示年度格局，不再定位出生所属步。

import { Solar } from 'lunar-javascript';

// ─── 基础常量 ──────────────────────────────────────────

export const TIAN_GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const DI_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const WU_XING = ['木', '火', '土', '金', '水'] as const;
type WuXing = (typeof WU_XING)[number];

// 五行相生：木→火→土→金→水→木
const SHENG_NEXT: Record<WuXing, WuXing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
// 五行相克：木克土，土克水，水克火，火克金，金克木
const KE: Record<WuXing, WuXing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

// 五行 → 五音（角徵宫商羽）
const WU_XING_TO_YIN: Record<WuXing, string> = { 木: '角', 火: '徵', 土: '宫', 金: '商', 水: '羽' };

// 天干化五运（甲己土、乙庚金、丙辛水、丁壬木、戊癸火）— 按 (干序 % 5)
const GAN_HUA_YUN: WuXing[] = ['土', '金', '水', '木', '火'];

// 地支化六气定司天 — 按 (支序 % 6)
const ZHI_SI_TIAN: string[] = ['少阴君火', '太阴湿土', '少阳相火', '阳明燥金', '太阳寒水', '厥阴风木'];

// 六气三阴三阳次序（用于司天/在泉/客气排布）：厥阴→少阴→太阴→少阳→阳明→太阳
const LIU_QI_CYCLE = ['厥阴风木', '少阴君火', '太阴湿土', '少阳相火', '阳明燥金', '太阳寒水'];

// 主气六步（每年固定）：厥阴风木→少阴君火→少阳相火→太阴湿土→阳明燥金→太阳寒水
//（君火在相火之前，三之气为少阳相火）
const ZHU_QI_FIXED = ['厥阴风木', '少阴君火', '少阳相火', '太阴湿土', '阳明燥金', '太阳寒水'];

// 地支本气五行（用于岁会判定）
const ZHI_BEN_QI: WuXing[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];

const QI_STEP_NAMES = ['初之气', '二之气', '三之气', '四之气', '五之气', '终之气'];
const YUN_STEP_NAMES = ['初运', '二运', '三运', '四运', '终运'];

// 主气六步的节气边界（固定，每年同序）
const ZHU_QI_TERMS = ['大寒', '春分', '小满', '大暑', '秋分', '小雪', '大寒'];
// 主运五步起于大寒，每步约 73.05 日（73.05 × 5 = 365.25）
const ZHU_YUN_DAY_OFFSETS = [0, 73.05, 146.1, 219.15, 292.2, 365.25];

const MS_PER_DAY = 86_400_000;

// ─── 类型 ──────────────────────────────────────────────

export interface WuYunLiuQiInput {
  /** 公历（标准时/北京时）年 */
  year: number;
  month: number;
  day: number;
  /** 时（标准时，0~23）；缺省 0 */
  hour?: number;
  /** 分；缺省 0 */
  minute?: number;
}

export interface QiInfo {
  /** 完整名，如「少阴君火」 */
  name: string;
  /** 三阴三阳，如「少阴」 */
  yinYang: string;
  /** 五行，如「火」 */
  element: WuXing;
}

export interface QiStep {
  /** 步名，如「初之气」/「初运」 */
  step: string;
  /** 六气全名（主气/客气用），如「厥阴风木」 */
  qi?: string;
  /** 三阴三阳（六气） */
  yinYang?: string;
  /** 五行 */
  element: WuXing;
  /** 五音（运用），如「太角」 */
  wuYin?: string;
  /** 太/少（运用） */
  taiShao?: '太' | '少';
  /** 起始节气名 */
  startTerm?: string;
  /** 终止节气名 */
  endTerm?: string;
  /** 起始公历日期，如「1月20日」 */
  startDate?: string;
  /** 终止公历日期 */
  endDate?: string;
  /** 出生时刻是否落于此步（交司定位） */
  current?: boolean;
}

/** 出生时所值之运步、气步（交司定位结果） */
export interface BirthQiYun {
  /** 运步名，如「二运」 */
  yunStep: string;
  /** 主运五音，如「太徵」 */
  zhuYunWuYin: string;
  /** 客运五音 */
  keYunWuYin: string;
  /** 气步名，如「二之气」 */
  qiStep: string;
  /** 主气名，如「少阴君火」 */
  zhuQi: string;
  /** 客气名 */
  keQi: string;
  /** 一句话描述 */
  note: string;
}

export interface WuYunLiuQiResult {
  /** 运气年（公历年，以大寒为界） */
  year: number;
  /** 年干支，如「庚午」 */
  ganZhi: string;
  gan: string;
  zhi: string;
  /** 中运 / 岁运 / 大运 */
  zhongYun: {
    element: WuXing;
    /** 太过 / 不及 */
    taiGuoBuJi: '太过' | '不及';
    /** 五音名，如「太商」 */
    wuYin: string;
    /** 五音字，如「商」 */
    yin: string;
    /** 概述，如「金运太过（太商）」 */
    label: string;
  };
  /** 司天（主上半年） */
  siTian: QiInfo;
  /** 在泉（主下半年） */
  zaiQuan: QiInfo;
  /** 主运五步 */
  zhuYun: QiStep[];
  /** 客运五步 */
  keYun: QiStep[];
  /** 主气六步 */
  zhuQi: QiStep[];
  /** 客气六步 */
  keQi: QiStep[];
  /** 运气同化（天符/岁会/太乙天符/同天符/同岁会） */
  tongHua: string[];
  /** 平气参考提示（不确定，仅供参考） */
  pingQiHint?: string;
  /** 运气年起点（大寒）公历日期 */
  startDate?: string;
  /** 出生时所值运步/气步（交司定位）；节气不可得或未提供出生时刻时为空 */
  current?: BirthQiYun;
  /** 一句话概述 */
  summary: string;
}

// ─── 工具 ──────────────────────────────────────────────

function parseQi(name: string): QiInfo {
  return {
    name,
    yinYang: name.slice(0, 2),
    element: name.slice(-1) as WuXing,
  };
}

/** 公历年 → 年干支（适用于立春后 / 运气年大寒后的常规年干支） */
function yearGanZhiOf(year: number): { gan: string; zhi: string } {
  const gi = ((year - 4) % 10 + 10) % 10;
  const zi = ((year - 4) % 12 + 12) % 12;
  return { gan: TIAN_GAN[gi], zhi: DI_ZHI[zi] };
}

/** 获取某公历年各节气的精确时刻（含时分），失败返回 null */
function getJieQiDates(year: number): Record<string, Date> | null {
  try {
    const table = Solar.fromYmd(year, 6, 1).getLunar().getJieQiTable();
    const out: Record<string, Date> = {};
    for (const key of Object.keys(table)) {
      const v = table[key];
      if (v && typeof v.getYear === 'function') {
        out[key] = new Date(
          v.getYear(),
          v.getMonth() - 1,
          v.getDay(),
          typeof v.getHour === 'function' ? v.getHour() : 0,
          typeof v.getMinute === 'function' ? v.getMinute() : 0,
          typeof v.getSecond === 'function' ? v.getSecond() : 0,
        );
      }
    }
    return out;
  } catch {
    return null;
  }
}

function fmtDate(d: Date | undefined): string | undefined {
  if (!d) return undefined;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 在 Date 上精确加上（可含小数）天数 */
function addDaysPrecise(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

/**
 * 在升序分界点数组中定位 t 所属区间 [bounds[i], bounds[i+1]) 的下标 i。
 * 任一分界缺失返回 -1；超出范围则钳制到首/末步。
 */
function findInterval(t: Date, bounds: (Date | undefined)[]): number {
  const ts = t.getTime();
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    if (!a || !b) return -1;
    if (ts >= a.getTime() && ts < b.getTime()) return i;
  }
  const first = bounds[0];
  const last = bounds[bounds.length - 1];
  if (first && ts < first.getTime()) return 0;
  if (last && ts >= last.getTime()) return bounds.length - 2;
  return -1;
}

// ─── 运气年解析 ────────────────────────────────────────

/**
 * 由出生公历日期/时刻解析「运气年」（以大寒交司时刻为界）及其年干支。
 * 出生早于当年大寒时刻 → 归入上一运气年。大寒数据不可得时退化为按公历年取干支。
 */
export function resolveYunQiYear(
  y: number,
  m: number,
  d: number,
  hour = 0,
  minute = 0,
): { year: number; gan: string; zhi: string } {
  let yq = y;
  const daHan = getJieQiDates(y)?.['大寒'];
  if (daHan) {
    const birth = new Date(y, m - 1, d, hour, minute);
    if (birth.getTime() < daHan.getTime()) yq = y - 1;
  }
  return { year: yq, ...yearGanZhiOf(yq) };
}

// ─── 主计算 ────────────────────────────────────────────

/**
 * 由年干支与运气年计算五运六气全貌；给定出生时刻则按交司定位所属运步/气步。
 * @param gan 年天干
 * @param zhi 年地支
 * @param year 运气年（公历年，用于节气时刻）
 * @param birthDate 出生标准时刻（用于交司定位）；缺省则不定位
 */
export function computeWuYunLiuQi(
  gan: string,
  zhi: string,
  year: number,
  birthDate?: Date | null,
): WuYunLiuQiResult {
  const gIdx = TIAN_GAN.indexOf(gan as (typeof TIAN_GAN)[number]);
  const zIdx = DI_ZHI.indexOf(zhi as (typeof DI_ZHI)[number]);
  if (gIdx < 0 || zIdx < 0) {
    throw new Error(`无效的年干支：${gan}${zhi}`);
  }

  // ── 中运 ──
  const zhongYunEl = GAN_HUA_YUN[gIdx % 5];
  const isTaiGuo = gIdx % 2 === 0; // 阳干太过、阴干不及
  const taiGuoBuJi: '太过' | '不及' = isTaiGuo ? '太过' : '不及';
  const baseTaiShao: '太' | '少' = isTaiGuo ? '太' : '少';
  const zhongYunYinChar = WU_XING_TO_YIN[zhongYunEl];
  const zhongYunWuYin = baseTaiShao + zhongYunYinChar;

  // ── 司天 / 在泉 ──
  const siTian = parseQi(ZHI_SI_TIAN[zIdx % 6]);
  const siTianCycleIdx = LIU_QI_CYCLE.indexOf(siTian.name);
  const zaiQuan = parseQi(LIU_QI_CYCLE[(siTianCycleIdx + 3) % 6]);

  // ── 节气精确时刻 ──
  const datesThis = getJieQiDates(year);
  const datesNext = getJieQiDates(year + 1);
  const daHanThis = datesThis?.['大寒'];
  const daHanNext = datesNext?.['大寒'];

  // 气步分界（7 点，真实中气时刻）：大寒→春分→小满→大暑→秋分→小雪→次年大寒
  const qiBoundaries: (Date | undefined)[] = [
    daHanThis,
    datesThis?.['春分'],
    datesThis?.['小满'],
    datesThis?.['大暑'],
    datesThis?.['秋分'],
    datesThis?.['小雪'],
    daHanNext,
  ];
  // 运步分界（6 点）：大寒交司时刻 + k×73.05 日（等分）
  const yunBoundaries: (Date | undefined)[] = daHanThis
    ? ZHU_YUN_DAY_OFFSETS.map((off) => addDaysPrecise(daHanThis, off))
    : new Array(6).fill(undefined);

  // ── 交司定位：出生所属气步 / 运步 ──
  const qiIdx = birthDate ? findInterval(birthDate, qiBoundaries) : -1;
  const yunIdx = birthDate ? findInterval(birthDate, yunBoundaries) : -1;

  // ── 主气六步（固定） ──
  const zhuQi: QiStep[] = ZHU_QI_FIXED.map((qiName, i) => {
    const info = parseQi(qiName);
    return {
      step: QI_STEP_NAMES[i],
      qi: qiName,
      yinYang: info.yinYang,
      element: info.element,
      startTerm: ZHU_QI_TERMS[i],
      endTerm: ZHU_QI_TERMS[i + 1],
      startDate: fmtDate(qiBoundaries[i]),
      endDate: fmtDate(qiBoundaries[i + 1]),
      current: i === qiIdx,
    };
  });

  // ── 客气六步（三之气=司天，按三阴三阳次序；初=司天-2 …… 终=司天+3=在泉）──
  const keQi: QiStep[] = QI_STEP_NAMES.map((stepName, i) => {
    const qiName = LIU_QI_CYCLE[(siTianCycleIdx - 2 + i + 6) % 6];
    const info = parseQi(qiName);
    const base = zhuQi[i]; // 客气与主气共用节气分步区间
    return {
      step: stepName,
      qi: qiName,
      yinYang: info.yinYang,
      element: info.element,
      startTerm: base.startTerm,
      endTerm: base.endTerm,
      startDate: base.startDate,
      endDate: base.endDate,
      current: i === qiIdx,
    };
  });

  // ── 主运五步（木火土金水固定；太少由中运太少按位次交替推定）──
  const zhongYunPos = WU_XING.indexOf(zhongYunEl);
  const zhuYun: QiStep[] = WU_XING.map((el, k) => {
    const flip = (k - zhongYunPos) % 2 !== 0;
    const ts: '太' | '少' = flip ? (baseTaiShao === '太' ? '少' : '太') : baseTaiShao;
    return {
      step: YUN_STEP_NAMES[k],
      element: el,
      taiShao: ts,
      wuYin: ts + WU_XING_TO_YIN[el],
      startTerm: '大寒',
      startDate: fmtDate(yunBoundaries[k]),
      endDate: fmtDate(yunBoundaries[k + 1]),
      current: k === yunIdx,
    };
  });

  // ── 客运五步（初运=中运，五行相生顺布，太少相生交替）──
  const keYun: QiStep[] = [];
  let curEl: WuXing = zhongYunEl;
  let curTs: '太' | '少' = baseTaiShao;
  for (let k = 0; k < 5; k++) {
    keYun.push({
      step: YUN_STEP_NAMES[k],
      element: curEl,
      taiShao: curTs,
      wuYin: curTs + WU_XING_TO_YIN[curEl],
      startTerm: zhuYun[k].startTerm,
      startDate: zhuYun[k].startDate,
      endDate: zhuYun[k].endDate,
      current: k === yunIdx,
    });
    curEl = SHENG_NEXT[curEl];
    curTs = curTs === '太' ? '少' : '太';
  }

  // ── 出生交司汇总 ──
  let current: BirthQiYun | undefined;
  if (qiIdx >= 0 && yunIdx >= 0) {
    const note =
      `出生交司：${YUN_STEP_NAMES[yunIdx]}（主运${zhuYun[yunIdx].wuYin} · 客运${keYun[yunIdx].wuYin}），` +
      `${QI_STEP_NAMES[qiIdx]}（主气${zhuQi[qiIdx].qi} · 客气${keQi[qiIdx].qi}）`;
    current = {
      yunStep: YUN_STEP_NAMES[yunIdx],
      zhuYunWuYin: zhuYun[yunIdx].wuYin!,
      keYunWuYin: keYun[yunIdx].wuYin!,
      qiStep: QI_STEP_NAMES[qiIdx],
      zhuQi: zhuQi[qiIdx].qi!,
      keQi: keQi[qiIdx].qi!,
      note,
    };
  }

  // ── 运气同化 ──
  const tongHua: string[] = [];
  const tianFu = zhongYunEl === siTian.element; // 天符：中运五行 = 司天五行
  const suiHui = zhongYunEl === ZHI_BEN_QI[zIdx]; // 岁会：中运五行 = 年支本气五行
  if (tianFu && suiHui) {
    tongHua.push('太乙天符');
  } else {
    if (tianFu) tongHua.push('天符');
    if (suiHui) tongHua.push('岁会');
  }
  // 同天符：太过之运 且 中运五行 = 在泉五行
  if (isTaiGuo && zhongYunEl === zaiQuan.element) tongHua.push('同天符');
  // 同岁会：不及之运 且 中运五行 = 在泉五行
  if (!isTaiGuo && zhongYunEl === zaiQuan.element) tongHua.push('同岁会');

  // ── 平气参考（不确定，仅提示）──
  let pingQiHint: string | undefined;
  if (isTaiGuo && KE[siTian.element] === zhongYunEl) {
    pingQiHint = `中运${zhongYunEl}运太过，而司天${siTian.name}克之，运盛被抑，或可转为平气（须结合实际气候判定）。`;
  } else if (!isTaiGuo) {
    const zhiEl = ZHI_BEN_QI[zIdx];
    const helped =
      siTian.element === zhongYunEl ||
      zaiQuan.element === zhongYunEl ||
      SHENG_NEXT[siTian.element] === zhongYunEl ||
      SHENG_NEXT[zaiQuan.element] === zhongYunEl ||
      zhiEl === zhongYunEl ||
      SHENG_NEXT[zhiEl] === zhongYunEl;
    if (helped) {
      pingQiHint = `中运${zhongYunEl}运不及，而得司天/在泉/年支之气资助，运衰得助，或可转为平气（须结合实际气候判定）。`;
    }
  }

  const zhongYunLabel = `${zhongYunEl}运${taiGuoBuJi}（${zhongYunWuYin}）`;
  const tongHuaLabel = tongHua.length ? `，${tongHua.join('、')}之年` : '';
  const summary = `${gan}${zhi}年：${zhongYunLabel}，${siTian.name}司天、${zaiQuan.name}在泉${tongHuaLabel}。`;

  return {
    year,
    ganZhi: `${gan}${zhi}`,
    gan,
    zhi,
    zhongYun: {
      element: zhongYunEl,
      taiGuoBuJi,
      wuYin: zhongYunWuYin,
      yin: zhongYunYinChar,
      label: zhongYunLabel,
    },
    siTian,
    zaiQuan,
    zhuYun,
    keYun,
    zhuQi,
    keQi,
    tongHua,
    pingQiHint,
    startDate: fmtDate(daHanThis),
    current,
    summary,
  };
}

// ─── 由出生信息派生 ────────────────────────────────────

/**
 * 由出生公历信息（标准时）派生五运六气，并按交司定位出生所属运步/气步。
 * 注意：须传入标准时（北京时）出生时刻，勿用真太阳时（与节气时刻时标须一致）。
 */
export function getWuYunLiuQi(birth: WuYunLiuQiInput): WuYunLiuQiResult | null {
  const { year, month, day, hour = 0, minute = 0 } = birth;
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') {
    return null;
  }
  try {
    const yq = resolveYunQiYear(year, month, day, hour, minute);
    const birthDate = new Date(year, month - 1, day, hour, minute);
    return computeWuYunLiuQi(yq.gan, yq.zhi, yq.year, birthDate);
  } catch (err) {
    console.error('五运六气计算失败', err);
    return null;
  }
}

// ─── 导出精简数据（JSON / AI）──────────────────────────

export function buildWuYunLiuQiExport(birth: WuYunLiuQiInput) {
  const w = getWuYunLiuQi(birth);
  if (!w) return undefined;
  const stepBrief = (s: QiStep) => ({
    步: s.step,
    ...(s.qi ? { 气: s.qi } : {}),
    五行: s.element,
    ...(s.wuYin ? { 五音: s.wuYin } : {}),
    ...(s.startDate ? { 起: s.startDate } : {}),
    ...(s.current ? { 本命: true } : {}),
  });
  return {
    运气年: w.year,
    年干支: w.ganZhi,
    中运: w.zhongYun.label,
    司天: w.siTian.name,
    在泉: w.zaiQuan.name,
    主运: w.zhuYun.map(stepBrief),
    客运: w.keYun.map(stepBrief),
    主气: w.zhuQi.map(stepBrief),
    客气: w.keQi.map(stepBrief),
    运气同化: w.tongHua,
    ...(w.current
      ? {
          本命所属: {
            运步: w.current.yunStep,
            主运: w.current.zhuYunWuYin,
            客运: w.current.keYunWuYin,
            气步: w.current.qiStep,
            主气: w.current.zhuQi,
            客气: w.current.keQi,
          },
        }
      : {}),
    ...(w.pingQiHint ? { 平气参考: w.pingQiHint } : {}),
    概述: w.summary,
  };
}

// ─── 导出 Markdown（单独复制 / AI）─────────────────────

function yunTableMd(steps: QiStep[]): string {
  const head = '| 步 | 五音 | 五行 | 起始 | 本命 |\n| --- | --- | --- | --- | --- |';
  const rows = steps.map(
    (s) => `| ${s.step} | ${s.wuYin ?? ''} | ${s.element} | ${s.startDate ?? '—'} | ${s.current ? '◀ 本命' : ''} |`,
  );
  return [head, ...rows].join('\n');
}

function qiTableMd(steps: QiStep[]): string {
  const head = '| 步 | 六气 | 三阴三阳 | 五行 | 起始 | 本命 |\n| --- | --- | --- | --- | --- | --- |';
  const rows = steps.map(
    (s) =>
      `| ${s.step} | ${s.qi ?? ''} | ${s.yinYang ?? ''} | ${s.element} | ${s.startDate ?? '—'} | ${s.current ? '◀ 本命' : ''} |`,
  );
  return [head, ...rows].join('\n');
}

/** 将五运六气格式化为 Markdown 文本（用于单独复制 / 喂 AI） */
export function buildWuYunLiuQiMarkdown(w: WuYunLiuQiResult): string {
  const lines: string[] = [
    `# 五运六气 · ${w.ganZhi}年`,
    '',
    `> 运气年以大寒为界${w.startDate ? `（${w.startDate}起）` : ''}`,
    '',
    `- **中运**：${w.zhongYun.label}`,
    `- **司天**：${w.siTian.name}`,
    `- **在泉**：${w.zaiQuan.name}`,
    `- **运气同化**：${w.tongHua.length ? w.tongHua.join('、') : '无'}`,
  ];
  if (w.current) {
    lines.push(`- **本命所属（交司）**：${w.current.note.replace(/^出生交司：/, '')}`);
  }
  lines.push(
    '',
    '## 五运',
    '',
    '### 主运（每年固定 · 木火土金水）',
    '',
    yunTableMd(w.zhuYun),
    '',
    '### 客运（始于中运 · 相生顺布）',
    '',
    yunTableMd(w.keYun),
    '',
    '## 六气',
    '',
    '### 主气（每年固定 · 大寒起）',
    '',
    qiTableMd(w.zhuQi),
    '',
    '### 客气（三之气＝司天 · 终之气＝在泉）',
    '',
    qiTableMd(w.keQi),
    '',
  );
  if (w.pingQiHint) {
    lines.push(`> 平气参考：${w.pingQiHint}`, '');
  }
  lines.push(w.summary);
  return lines.join('\n');
}
