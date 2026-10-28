// 节气按出生瞬间判定（移植自 react-mcp tests/solar-term-scale.test.ts，用例与随机种子保持一致以便两边对照）。
import { describe, expect, it } from 'vitest';
import * as lunarJavascript from 'lunar-javascript';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { calculateChart } from '../src/lib/engine';
import type { UnifiedBaziChart } from '../src/lib/engine';
import { solarTermShiftFor, solarTermShiftMinutes, withSolarTermShift } from '../src/lib/engine/jieqi-scale';
import { shiftTymeSolarTerms } from '../src/lib/engine/tyme/jieqi-scale';
import { applyTrueSolarTime, getTrueSolarOffset } from '../src/lib/engine/mystilight/ext/utils';
import { getCityByName } from '../src/lib/cities';
import { computeSiLing } from '../src/lib/siling';
import type { BaziInput } from '../src/lib/bazi';

// 对照用独立的 npm lunar-javascript（不是 mystilight 内联、被补丁的那份）。
const Solar = (lunarJavascript as any).Solar;
interface Clock { year: number; month: number; day: number; hour: number; minute: number }
const pad = (n: number) => String(n).padStart(2, '0');
const fields = (ms: number): Clock => {
  const d = new Date(ms);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
};
const wall = (c: Clock, second = 0) => Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, second);
const offsetMinutesOf = (b: BaziInput) => Math.round((b.utcOffset ?? 8) * 60);
const longitudeOf = (b: BaziInput) => b.longitude ?? (b.city ? getCityByName(b.city)?.longitude : undefined);

/**
 * 不经应用平移、按瞬间口径独立算出的期望盘：
 * 年/月柱与所取之节按出生瞬间的北京时读数；日/时柱按当地（或真太阳时）读数；
 * 起运按上游 sect-1 公式（日差×4 月、时辰差×10 日），先把该节换到当地尺度再比。
 */
function oracle(b: BaziInput) {
  const clockOffset = offsetMinutesOf(b);
  const instant = wall(b) - clockOffset * 60000;
  const bj = fields(instant + 480 * 60000);
  const atInstant = Solar.fromYmdHms(bj.year, bj.month, bj.day, bj.hour, bj.minute, 0).getLunar();
  let frame: Clock = b; let frameOffset = clockOffset;
  const longitude = longitudeOf(b);
  if (longitude !== undefined) {
    const meridian = (b.utcOffset ?? 8) * 15;
    frameOffset += getTrueSolarOffset(b.year, b.month, b.day, longitude, meridian).total;
    frame = applyTrueSolarTime(b.year, b.month, b.day, b.hour, b.minute, longitude, meridian);
  }
  const local = Solar.fromYmdHms(frame.year, frame.month, frame.day, frame.hour, frame.minute, 0).getLunar();
  const forward = (atInstant.getYearGanIndexExact() % 2 === 0) === (b.gender === 1);
  const jie = (forward ? atInstant.getNextJie() : atInstant.getPrevJie()).getSolar();
  const shift = frameOffset - 480;
  const jieOnFrame = wall({ year: jie.getYear(), month: jie.getMonth(), day: jie.getDay(), hour: jie.getHour(), minute: jie.getMinute() }, jie.getSecond()) + shift * 60000;
  const birthOnFrame = wall(frame);
  const [start, end] = forward ? [birthOnFrame, jieOnFrame] : [jieOnFrame, birthOnFrame];
  const zhi = (ms: number) => { const h = new Date(ms).getUTCHours(); return h === 23 ? 11 : Math.floor((h + 1) / 2); };
  let hourDiff = zhi(end) - zhi(start);
  let dayDiff = Math.floor(end / 86400000) - Math.floor(start / 86400000);
  if (hourDiff < 0) { hourDiff += 12; dayDiff--; }
  const monthDiff = Math.floor(hourDiff * 10 / 30);
  let months = dayDiff * 4 + monthDiff;
  const days = hourDiff * 10 - monthDiff * 30;
  const years = Math.floor(months / 12);
  months -= years * 12;
  // tyme4ts AbstractChildLimitProvider.next 的日历加法（日溢出顺延到后续月份）
  let y = frame.year + years, m = frame.month + months;
  while (m > 12) { m -= 12; y++; }
  let d = frame.day + days;
  let count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  while (d > count) { d -= count; m++; if (m > 12) { m = 1; y++; } count = new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  return {
    pillars: [atInstant.getYearInGanZhiExact(), atInstant.getMonthInGanZhiExact(), local.getDayInGanZhiExact(), local.getTimeInGanZhi()],
    offsets: { years, months, days }, start: `${y}-${pad(m)}-${pad(d)}`, shift,
  };
}

const pillarsOf = (c: UnifiedBaziChart) => (['year', 'month', 'day', 'time'] as const).map((k) => c.pillars[k].gan + c.pillars[k].zhi);
const chart = (b: BaziInput, engine: 'mystilight' | 'tyme') => calculateChart(b, engine);
function expectOracle(b: BaziInput, out: UnifiedBaziChart, expected: ReturnType<typeof oracle>, engine: 'mystilight' | 'tyme') {
  expect(pillarsOf(out)).toEqual(expected.pillars);
  expect(solarTermShiftFor(b, (out as any)._solarTimeInfo)).toBe(expected.shift);
  if (engine === 'tyme') expect(out.yun.startSolar.slice(0, 10)).toBe(expected.start);
  else expect(out.yun).toMatchObject({ startYear: expected.offsets.years, startMonth: expected.offsets.months, startDay: expected.offsets.days });
}

describe('八字节气按出生瞬间判定，日时柱按当地时间', () => {
  const ny: BaziInput = { year: 2024, month: 2, day: 4, hour: 10, minute: 0, gender: 1, sect: 1, utcOffset: -5 };
  for (const engine of ['mystilight', 'tyme'] as const) it(`${engine}：纽约立春后出生取甲辰丙寅，日时柱仍按纽约钟表`, async () => {
    const out = await chart(ny, engine);
    // 立春 2024-02-04 16:27 CST = 03:27 EST；10:00 EST 已在立春后。
    expect(pillarsOf(out)).toEqual(['甲辰', '丙寅', '戊戌', '丁巳']);
    expect(computeSiLing(ny, out.pillars.day.gan, out.pillars.month.zhi)?.monthZhi).toBe(out.pillars.month.zhi);
    expect(solarTermShiftFor(ny, (out as any)._solarTimeInfo)).toBe(-780);
    expectOracle(ny, out, oracle(ny), engine);
  });

  // 1990 年中国夏令时（UTC+9）：芒种 06:46 北京标准时 = 07:46 夏令时钟表；07:20 出生仍在芒种前（巳月）。
  const chinaDst: BaziInput = { year: 1990, month: 6, day: 6, hour: 7, minute: 20, gender: 1, sect: 1, utcOffset: 9 };
  for (const engine of ['mystilight', 'tyme'] as const) it(`${engine}：中国夏令时钟表先换回标准时再比节气`, async () => {
    const out = await chart(chinaDst, engine);
    expect(pillarsOf(out).slice(0, 2)).toEqual(['庚午', '辛巳']);
    expectOracle(chinaDst, out, oracle(chinaDst), engine);
  });

  const goldens: { label: string; start: string; b: BaziInput }[] = [
    { label: '北京男', start: '1997-11-25', b: { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' } },
    { label: '重庆女', start: '1990-02-20', b: { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 1, city: '重庆' } },
    { label: '悉尼男', start: '1993-06-25', b: { year: 1992, month: 12, day: 5, hour: 14, minute: 0, gender: 1, sect: 1, longitude: 151.2, latitude: -33.87, utcOffset: 10 } },
    { label: '纽约女', start: '1989-12-10', b: { year: 1988, month: 3, day: 10, hour: 9, minute: 15, gender: 0, sect: 1, longitude: -74.0, latitude: 40.7, utcOffset: -5 } },
  ];
  it.each(goldens)('golden 命例 $label 的新起运日 $start 由独立对照得出', async ({ b, start }) => {
    const expected = oracle(b);
    expect(expected.start).toBe(start);
    for (const engine of ['mystilight', 'tyme'] as const) expectOracle(b, await chart(b, engine), expected, engine);
  });

  it('东八区不启用真太阳时不平移，结果与未平移计算一致', async () => {
    const b: BaziInput = { year: 2024, month: 2, day: 4, hour: 16, minute: 20, gender: 0, sect: 1 };
    for (const engine of ['mystilight', 'tyme'] as const) {
      const out = await chart(b, engine);
      expect(solarTermShiftFor(b, (out as any)._solarTimeInfo)).toBe(0);
      expect(pillarsOf(out).slice(0, 2)).toEqual(['癸卯', '乙丑']);
      expectOracle(b, out, oracle(b), engine);
    }
  });

  it('平移只在单次计算内生效并完整恢复', async () => {
    const b: BaziInput = { year: 1990, month: 5, day: 17, hour: 10, minute: 30, gender: 1, sect: 1 };
    const before = await chart(b, 'tyme');
    await chart(ny, 'tyme'); await chart(ny, 'mystilight');
    expect(await chart(b, 'tyme')).toEqual(before);
    const julianDay = SolarTerm.prototype.getJulianDay, getTerm = SolarTime.prototype.getTerm;
    expect(() => withSolarTermShift(-780, () => withSolarTermShift(60, () => 0))).toThrow('嵌套');
    expect(() => withSolarTermShift(-780, () => { throw new Error('boom'); }, shiftTymeSolarTerms)).toThrow('boom');
    expect([SolarTerm.prototype.getJulianDay, SolarTime.prototype.getTerm]).toEqual([julianDay, getTerm]);
    expect(withSolarTermShift(0, () => 'same')).toBe('same');
    expect(solarTermShiftMinutes(-300)).toBe(-780);
    expect(solarTermShiftMinutes(480, -15)).toBe(-15);
  });

  // 确定性随机：半数出生落在真实交节前后的时间尺度差内——未平移的引擎在此会与瞬间口径错开年柱或月柱。
  let seed = 0x5eed1234;
  const rand = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const zones = ['-10:00', '-07:00', '-05:00', '-03:00', '+00:00', '+01:00', '+03:30', '+05:30', '+08:00', '+09:00', '+10:00', '+12:45'];
  const cases: { label: string; b: BaziInput }[] = [];
  for (let i = 0; i < 48; i++) {
    const zone = zones[Math.floor(rand() * zones.length)]!;
    const sign = zone.startsWith('-') ? -1 : 1;
    const offset = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
    const trueSolarTime = rand() < 0.5;
    const longitude = Math.round((offset / 4 + (rand() - 0.5) * 30) * 100) / 100;
    const year = 1950 + Math.floor(rand() * 100), month = 1 + Math.floor(rand() * 12);
    let instant: number;
    if (i % 2 === 0) {
      const jie = Solar.fromYmdHms(year, month, 15, 12, 0, 0).getLunar().getPrevJie().getSolar();
      const jieUtc = wall({ year: jie.getYear(), month: jie.getMonth(), day: jie.getDay(), hour: jie.getHour(), minute: jie.getMinute() }) - 480 * 60000;
      const gap = Math.abs(offset - 480) + 150;
      instant = jieUtc + Math.round((rand() * 2 - 1) * gap) * 60000;
    } else {
      instant = Date.UTC(year, month - 1, 1 + Math.floor(rand() * 28), Math.floor(rand() * 24), Math.floor(rand() * 60));
    }
    const local = fields(instant + offset * 60000);
    const male = rand() < 0.5;
    const b: BaziInput = {
      ...local, gender: male ? 1 : 0, sect: 1, utcOffset: offset / 60, ...(trueSolarTime ? { longitude } : {}),
    };
    cases.push({ label: `${local.year}-${pad(local.month)}-${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)} ${zone}${trueSolarTime ? ` 真太阳时${longitude}` : ''} ${male ? 'male' : 'female'}`, b });
  }
  it.each(cases)('$label 与独立瞬间口径一致', async ({ b }) => {
    const expected = oracle(b);
    for (const engine of ['mystilight', 'tyme'] as const) expectOracle(b, await chart(b, engine), expected, engine);
  });
});
