// tyme4ts 引擎适配器：将 6tail 干支历标准算法归一化为统一命盘模型。
// 十神/流月等推算复用 mystilight ext 层的通用干支算法（两家同法，输出口径一致）。
import { SolarTime, ChildLimit, Gender, SixtyCycleYear } from 'tyme4ts';
import type { SixtyCycle, HeavenStem, DecadeFortune } from 'tyme4ts';
import type { BaziInput } from '../../bazi';
import type { BaziEngine } from '../types';
import type { UnifiedBaziChart } from '../model';
import type { Pillar, CurrentYun, DayunArrItem } from '../mystilight/upstream';
import { getEngineDescriptor } from '../registry';
import { getShiShen } from '../mystilight/ext/shishen';
import { applyTrueSolarTime, getTrueSolarOffset } from '../mystilight/ext/utils';
import { getCityByName } from '../../cities';
import { getGanWuXing, getZhiWuXing } from '../../utils';
import { applySect } from './sects';

// 十神全称 → mystilight dayunArr 用的简称
const SHI_SHEN_SHORT: Record<string, string> = {
  比肩: '比', 劫财: '劫', 食神: '食', 伤官: '伤',
  正财: '财', 偏财: '才', 正官: '官', 七杀: '杀',
  正印: '印', 偏印: '枭',
};
const short = (s: string) => SHI_SHEN_SHORT[s] || s;

const pad = (n: number) => String(n).padStart(2, '0');

function pillarOf(sc: SixtyCycle, dayStem: HeavenStem, value: number): Pillar {
  const gan = sc.getHeavenStem();
  const zhi = sc.getEarthBranch();
  const dayGanName = dayStem.getName();
  const hides: { gan: HeavenStem; qiLevel: '本气' | '中气' | '余气' }[] = [];
  const main = zhi.getHideHeavenStemMain();
  const middle = zhi.getHideHeavenStemMiddle();
  const residual = zhi.getHideHeavenStemResidual();
  if (main) hides.push({ gan: main, qiLevel: '本气' });
  if (middle) hides.push({ gan: middle, qiLevel: '中气' });
  if (residual) hides.push({ gan: residual, qiLevel: '余气' });

  const hideGanAttr = hides.map((h) => ({
    gan: h.gan.getName(),
    qiLevel: h.qiLevel,
    wuXing: getGanWuXing(h.gan.getName()) as Pillar['hideGanAttr'][number]['wuXing'],
    shiShen: getShiShen(dayGanName, h.gan.getName()),
  }));

  return {
    value,
    gan: gan.getName(),
    zhi: zhi.getName(),
    hideGan: hides.map((h) => h.gan.getName()).join(''),
    wuXing: `${getGanWuXing(gan.getName())}${getZhiWuXing(zhi.getName())}`,
    naYin: sc.getSound().getName(),
    shiShenGan: getShiShen(dayGanName, gan.getName()),
    shiShenZhi: hideGanAttr.map((h) => h.shiShen).join(','),
    diShi: dayStem.getTerrain(zhi).getName(),
    xun: sc.getTen().getName(),
    xunKong: sc.getExtraEarthBranches().map((b) => b.getName()).join(''),
    hideGanAttr,
  };
}

/** 与 mystilight 相同的真太阳时预处理（保持两引擎输入口径一致） */
function resolveInput(input: BaziInput) {
  let { year, month, day, hour, minute } = input;
  let solarTimeInfo: Record<string, unknown> = { applied: false };
  let lng = input.longitude;
  if (!lng && input.city) lng = getCityByName(input.city)?.longitude;
  if (lng !== undefined) {
    const off = getTrueSolarOffset(year, month, day, lng);
    const adjusted = applyTrueSolarTime(year, month, day, hour, minute, lng);
    ({ year, month, day, hour, minute } = adjusted);
    solarTimeInfo = {
      applied: true,
      city: input.city,
      offsetMinutes: off.total,
      longitudeMinutes: off.longitudeMinutes,
      eotMinutes: off.eotMinutes,
      adjustedTime: adjusted,
    };
  }
  return { year, month, day, hour, minute, solarTimeInfo };
}

function calculate(input: BaziInput): UnifiedBaziChart {
  applySect(input.sect);
  const { year, month, day, hour, minute, solarTimeInfo } = resolveInput(input);

  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, minute, 0);
  const eightChar = solarTime.getLunarHour().getEightChar();
  const dayStem = eightChar.getDay().getHeavenStem();
  const dayGanName = dayStem.getName();

  const childLimit = ChildLimit.fromSolarTime(solarTime, input.gender === 1 ? Gender.MAN : Gender.WOMAN);
  const endTime = childLimit.getEndTime();
  // 1.5.2 的 d.ts 未声明这些便捷 getter（运行时由基类提供，已实证），此处局部补型
  const et = endTime as unknown as {
    getYear(): number; getMonth(): number; getDay(): number;
    getHour(): number; getMinute(): number; getSecond(): number;
  };

  // ── 大运（14 轮）+ 逐运流年（10 年/轮） ──
  const dayunArr: DayunArrItem[] = [];
  let df: DecadeFortune = childLimit.getStartDecadeFortune();
  for (let i = 0; i < 14; i++) {
    const sc = df.getSixtyCycle();
    const startYear = df.getStartSixtyCycleYear().getYear();
    const liunianArr = Array.from({ length: 10 }, (_, k) => {
      const y = startYear + k;
      const ysc = SixtyCycleYear.fromYear(y).getSixtyCycle();
      return {
        year: y,
        ganZhi: ysc.getName(),
        ganshen: short(getShiShen(dayGanName, ysc.getHeavenStem().getName())),
        zhishen: short(getShiShen(dayGanName, ysc.getEarthBranch().getHideHeavenStemMain().getName())),
      };
    });
    dayunArr.push({
      startYear,
      ganZhi: sc.getName(),
      ganshen: short(getShiShen(dayGanName, sc.getHeavenStem().getName())),
      zhishen: short(getShiShen(dayGanName, sc.getEarthBranch().getHideHeavenStemMain().getName())),
      liunianArr,
    });
    df = df.next(1);
  }

  // ── 当前所行大运/流年 ──
  const nowYear = new Date().getFullYear();
  const curDy = dayunArr.find((d) => nowYear >= d.startYear && nowYear < d.startYear + 10) ?? null;
  const curYearSc = SixtyCycleYear.fromYear(nowYear).getSixtyCycle();
  const currentYun: CurrentYun = {
    daYun: curDy
      ? {
          startYear: curDy.startYear, endYear: curDy.startYear + 9,
          startAge: curDy.startYear - year + 1, endAge: curDy.startYear - year + 10,
          index: dayunArr.indexOf(curDy),
          ganZhi: [curDy.ganZhi[0], curDy.ganZhi[1]],
          xun: '', xunKong: '',
          shiShen: getShiShen(dayGanName, curDy.ganZhi[0]),
        }
      : null,
    liuNian: {
      year: nowYear, age: nowYear - year + 1, index: 0,
      ganZhi: [curYearSc.getHeavenStem().getName(), curYearSc.getEarthBranch().getName()],
      xun: curYearSc.getTen().getName(),
      xunKong: curYearSc.getExtraEarthBranches().map((b) => b.getName()).join(''),
      shiShen: getShiShen(dayGanName, curYearSc.getHeavenStem().getName()),
    },
    xiaoYun: null,
  };

  const descriptor = getEngineDescriptor('tyme');
  const chart: UnifiedBaziChart = {
    input: { year, month, day, hour, minute, second: 0 },
    current: { year: nowYear, month: new Date().getMonth() + 1, day: new Date().getDate() },
    sect: input.sect,
    gender: input.gender === 1 ? '男' : '女',
    pillars: {
      year: pillarOf(eightChar.getYear(), dayStem, year),
      month: pillarOf(eightChar.getMonth(), dayStem, month),
      day: pillarOf(eightChar.getDay(), dayStem, day),
      time: pillarOf(eightChar.getHour(), dayStem, hour),
      dayMasterGan: dayGanName,
    },
    taiYuan: eightChar.getFetalOrigin().getName(),
    taiYuanNaYin: eightChar.getFetalOrigin().getSound().getName(),
    taiXi: eightChar.getFetalBreath().getName(),
    taiXiNaYin: eightChar.getFetalBreath().getSound().getName(),
    mingGong: eightChar.getOwnSign().getName(),
    mingGongNaYin: eightChar.getOwnSign().getSound().getName(),
    shenGong: eightChar.getBodySign().getName(),
    shenGongNaYin: eightChar.getBodySign().getSound().getName(),
    yun: {
      gender: input.gender,
      forward: childLimit.isForward(),
      startYear: et.getYear(),
      startMonth: et.getMonth(),
      startDay: et.getDay(),
      startHour: et.getHour(),
      startSolar: `${et.getYear()}-${pad(et.getMonth())}-${pad(et.getDay())} ${pad(et.getHour())}:${pad(et.getMinute())}:${pad(et.getSecond())}`,
    },
    dayunArr,
    currentYun,
    engine: { id: descriptor.id, name: descriptor.name, school: descriptor.school },
  };
  (chart as Record<string, unknown>)._solarTimeInfo = solarTimeInfo;
  return chart;
}

export const engine: BaziEngine = {
  ...getEngineDescriptor('tyme'),
  calculate,
};
