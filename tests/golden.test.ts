// Golden-case 回归测试：四柱/起运/双引擎一致性。
//
// 期望值来源：当前代码计算 + 双引擎对拍硬一致 + 手工复核（立春时刻对天文数据、
// 月柱五虎遁、时柱五鼠遁逐项核对），冻结为回归基准——目的是防引擎依赖升级
// （dependabot 每周检查 mystilight-8char / tyme4ts / lunar-javascript）引入排盘回归。
import { describe, it, expect } from 'vitest';
import { calculateBazi } from '../src/lib/bazi';
import type { BaziInput, BaziResult } from '../src/lib/bazi';
import { compareEngines } from '../src/lib/engine';

const pillarsOf = (c: BaziResult) =>
  (['year', 'month', 'day', 'time'] as const).map((k) => c.pillars[k].gan + c.pillars[k].zhi).join(' ');

interface Golden {
  name: string;
  input: BaziInput;
  pillars: string;
  /** 起运日期（yun.startSolar 前 10 位） */
  startDate: string;
}

const GOLDEN_CASES: Golden[] = [
  {
    name: '北京男（真太阳时 -15 分）',
    input: { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' },
    pillars: '庚午 壬午 辛亥 壬辰',
    startDate: '1997-12-05',
  },
  {
    name: '重庆女（晚子时+真太阳时移出子时）',
    input: { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 1, city: '重庆' },
    pillars: '甲子 丁丑 己未 乙亥',
    startDate: '1990-02-09',
  },
  {
    name: '悉尼男（南半球，UTC+10）',
    input: { year: 1992, month: 12, day: 5, hour: 14, minute: 0, gender: 1, sect: 1, longitude: 151.2, latitude: -33.87, utcOffset: 10 },
    pillars: '壬申 辛亥 乙卯 癸未',
    startDate: '1993-06-15',
  },
  {
    name: '纽约女（西经，UTC-5）',
    input: { year: 1988, month: 3, day: 10, hour: 9, minute: 15, gender: 0, sect: 1, longitude: -74.0, latitude: 40.7, utcOffset: -5 },
    pillars: '戊辰 乙卯 甲子 己巳',
    startDate: '1989-10-10',
  },
];

describe('命例 golden：四柱与起运', () => {
  for (const g of GOLDEN_CASES) {
    it(g.name, () => {
      const c = calculateBazi(g.input);
      expect(pillarsOf(c)).toBe(g.pillars);
      expect(c.yun?.startSolar?.slice(0, 10)).toBe(g.startDate);
    });
  }
});

describe('双引擎对拍：mystilight × tyme4ts 硬一致（核心防回归屏障）', () => {
  for (const g of GOLDEN_CASES) {
    it(g.name, async () => {
      const r = await compareEngines(g.input);
      expect(r.consistent, `硬差异：${r.items.filter((i) => i.kind === 'hard').map((i) => `${i.label}: ${i.a} vs ${i.b}`).join('; ')}`).toBe(true);
    });
  }
});

describe('边界例：立春（年柱/月柱换界）', () => {
  // 2000 年立春：2月4日 20:40（北京时）
  it('立春前生：年柱仍属己卯、月柱丑', () => {
    const c = calculateBazi({ year: 2000, month: 2, day: 4, hour: 10, minute: 0, gender: 1, sect: 1 });
    expect(pillarsOf(c)).toBe('己卯 丁丑 壬辰 乙巳');
  });
  it('立春后生：年柱换庚辰、月柱换戊寅（乙庚之岁戊为头）', () => {
    const c = calculateBazi({ year: 2000, month: 2, day: 4, hour: 22, minute: 0, gender: 1, sect: 1 });
    expect(pillarsOf(c)).toBe('庚辰 戊寅 壬辰 辛亥');
  });
});

describe('边界例：早晚子时分派（sect 语义锁定）', () => {
  const base = { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0 as const };
  it('sect1 正统派：晚子时日柱算次日（庚申）', () => {
    const c = calculateBazi({ ...base, sect: 1 });
    expect(pillarsOf(c)).toBe('甲子 丁丑 庚申 丙子');
  });
  it('sect2 传统派：晚子时日柱算当天（己未）', () => {
    const c = calculateBazi({ ...base, sect: 2 });
    expect(pillarsOf(c)).toBe('甲子 丁丑 己未 丙子');
  });
});

describe('边界例：真太阳时跨日（00:05 校正至前一日 23:5x）', () => {
  const base = { year: 2010, month: 5, day: 5, hour: 0, minute: 5, gender: 1 as const };
  it('sect1：四柱不变（晚子时算次日抵消跨日），但起运时刻改变', () => {
    const plain = calculateBazi({ ...base, sect: 1 });
    const adj = calculateBazi({ ...base, sect: 1, city: '北京' });
    expect(pillarsOf(plain)).toBe('庚寅 庚辰 乙卯 丙子');
    expect(pillarsOf(adj)).toBe('庚寅 庚辰 乙卯 丙子');
    expect(plain.yun?.startSolar?.slice(0, 10)).toBe('2010-08-25');
    expect(adj.yun?.startSolar?.slice(0, 10)).toBe('2010-09-04');
    const st = (adj as any)._solarTimeInfo;
    expect(st.applied).toBe(true);
    expect(st.adjustedTime).toMatchObject({ year: 2010, month: 5, day: 4, hour: 23 });
  });
  it('sect2：日柱退一日（乙卯 → 甲寅）', () => {
    const plain = calculateBazi({ ...base, sect: 2 });
    const adj = calculateBazi({ ...base, sect: 2, city: '北京' });
    expect(pillarsOf(plain)).toBe('庚寅 庚辰 乙卯 丙子');
    expect(pillarsOf(adj)).toBe('庚寅 庚辰 甲寅 丙子');
  });
});
