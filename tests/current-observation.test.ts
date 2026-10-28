import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateBazi, type BaziInput } from '../src/lib/bazi';

const originalTZ = process.env.TZ;
const born: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, utcOffset: -5, longitude: -74 };
function currentMonth(input = born) {
  const chart = calculateBazi(input);
  return { month: chart.currentYun?.liuYue?.ganZhi?.join(''), monthData: chart.currentYun?.liuYue,
    monthShenSha: (chart.shensha as { current: { liuYue: string[] } }).current.liuYue,
    pillars: chart.pillars, yun: chart.yun };
}
afterEach(() => {
  vi.useRealTimers();
  if (originalTZ === undefined) delete process.env.TZ; else process.env.TZ = originalTZ;
});

describe('浏览器当前流月不继承出生节气尺度', () => {
  it('纽约出生在北京1月5日查询仍为甲子月', () => {
    process.env.TZ = 'Asia/Shanghai'; vi.useFakeTimers(); vi.setSystemTime(new Date('2024-01-05T04:00:00Z'));
    expect(currentMonth().month).toBe('甲子');
    expect(currentMonth({ ...born, longitude: undefined }).month).toBe('甲子');
  });
  for (const sect of [1, 2] as const) it(`sect=${sect} 当前时分精确跨节，同瞬间切浏览器时区仍一致`, () => {
    vi.useFakeTimers(); process.env.TZ = 'Asia/Shanghai';
    vi.setSystemTime(new Date('2024-01-05T20:48:00Z'));
    const before = currentMonth({ ...born, sect });
    vi.setSystemTime(new Date('2024-01-05T20:50:00Z'));
    const after = currentMonth({ ...born, sect });
    expect(before.month).toBe('甲子'); expect(after.month).toBe('乙丑');
    expect(before.monthData?.shiShen).toBe('正财'); expect(after.monthData?.shiShen).toBe('偏财');
    expect(before.monthShenSha).toContain('桃花(日)'); expect(after.monthShenSha).not.toContain('桃花(日)');
    expect(after.monthShenSha).toContain('天乙贵人(年)');
    expect(after.pillars).toEqual(before.pillars); expect(after.yun).toEqual(before.yun);
    process.env.TZ = 'America/New_York';
    const sameAfter = currentMonth({ ...born, sect });
    expect(sameAfter.monthData).toEqual(after.monthData); expect(sameAfter.monthShenSha).toEqual(after.monthShenSha);
    vi.setSystemTime(new Date('2024-01-05T20:48:00Z'));
    const sameBefore = currentMonth({ ...born, sect });
    expect(sameBefore.monthData).toEqual(before.monthData); expect(sameBefore.monthShenSha).toEqual(before.monthShenSha);
  });
  it('当前夏令时偏移与出生标准时分开，计算后无全局残留', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2024-04-04T08:00:00Z'));
    process.env.TZ = 'America/New_York'; const west = currentMonth();
    process.env.TZ = 'Asia/Shanghai'; expect(currentMonth().month).toBe(west.month);
    expect((globalThis as Record<symbol, unknown>)[Symbol.for('react-mcp.jieqiShiftDays')]).toBeUndefined();
  });
});
