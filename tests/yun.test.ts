// 岁运层新模块回归:岁运格局扫描 / 十年规划表 / 五行能量计点 / 子平真诠原文接入。
// 取值均先经探针对拍与手工推演核对后冻结(golden:1990-06-15 08:30 北京男 → 庚午 壬午 辛亥 壬辰,身弱)。
import { describe, it, expect, beforeAll } from 'vitest';
import { calculateBazi, buildExportJSON, type BaziInput, type BaziResult } from '../src/lib/bazi';
import { buildLifeKline } from '../src/lib/lifekline';
import { detectYunPatterns } from '../src/lib/yunpatterns';
import { buildDecadePlan } from '../src/lib/decadeplan';
import { buildWuxingEnergy, ZHI_CANG_POINTS } from '../src/lib/wuxing-energy';
import { preloadZiping, getZipingClassic, geToChapterKey } from '../src/lib/zipingzhenquan';
import { ZIPING_ZHENQUAN } from '../src/lib/data/zipingzhenquan';

const GOLDEN: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' };

let chart: BaziResult;
let judge: string;

beforeAll(async () => {
  await preloadZiping();
  chart = calculateBazi(GOLDEN);
  judge = buildLifeKline(chart)?.judge ?? '';
});

describe('岁运格局扫描 detectYunPatterns', () => {
  it('丙戌运:官星入局三连(合日干/伤官见官/官杀混杂),不冲提纲', () => {
    const hits = detectYunPatterns({ pillars: chart.pillars, judge, gender: chart.gender, dayunGz: '丙戌' });
    const names = hits.map((h) => h.name);
    expect(names).toContain('运干合日干');
    expect(names).toContain('伤官见官(运成象)');
    expect(names).toContain('官杀混杂(运凑成)');
    expect(names).not.toContain('大运冲提纲');
    expect(hits.find((h) => h.name === '伤官见官(运成象)')?.kind).toBe('凶');
    expect(hits.find((h) => h.name === '运干合日干')?.basis).toContain('正官');
  });

  it('丁亥运×丁巳年:天克地冲日柱(抑制普通冲婚姻宫)+岁运交战+七杀攻身', () => {
    const hits = detectYunPatterns({ pillars: chart.pillars, judge, gender: chart.gender, dayunGz: '丁亥', liunianGz: '丁巳' });
    const names = hits.map((h) => h.name);
    expect(names).toContain('天克地冲日柱(年)');
    expect(names).not.toContain('流年冲婚姻宫'); // 已并入天克地冲,不重复报
    expect(names).toContain('岁运交战');
    expect(names).toContain('七杀攻身(身弱)');
    expect(names).toContain('伤官见官(年成象)');
  });

  it('戊子运×丁卯年:大运冲提纲(子冲双午)+流年入空亡(卯落寅卯空且无冲)', () => {
    const hits = detectYunPatterns({ pillars: chart.pillars, judge, gender: chart.gender, dayunGz: '戊子', liunianGz: '丁卯' });
    const names = hits.map((h) => h.name);
    expect(names).toContain('大运冲提纲');
    expect(names).toContain('流年入空亡');
    expect(hits.find((h) => h.name === '流年入空亡')?.basis).toContain('寅卯');
  });

  it('岁运并临:流年与大运同柱即命中', () => {
    const hits = detectYunPatterns({ pillars: chart.pillars, judge, dayunGz: '丙戌', liunianGz: '丙戌' });
    expect(hits.map((h) => h.name)).toContain('岁运并临');
  });

  it('甲申运:平运无格局命中(计分事件由K线层表达)', () => {
    const hits = detectYunPatterns({ pillars: chart.pillars, judge, gender: chart.gender, dayunGz: '甲申' });
    expect(hits).toHaveLength(0);
  });
});

describe('十年规划表 buildDecadePlan', () => {
  it('一运一行:丙戌运十神/喜忌/年段正确,均值与K线大运均分一致', () => {
    const k = buildLifeKline(chart);
    const dp = buildDecadePlan(chart, k);
    expect(dp).not.toBeNull();
    const row = dp!.rows.find((r) => r.ganZhi === '丙戌')!;
    expect(row.startYear).toBe(2027);
    expect(row.ganShen).toBe('正官'); // 丙对辛
    expect(row.zhiShen).toBe('正印'); // 戌本气戊对辛
    expect(row.favor).toBe('干忌支喜'); // 身弱辛金喜土金:丙火忌、戌土喜
    expect(row.avg).toBe(k!.decades.find((d) => d.ganZhi === '丙戌')!.avg.total);
    expect(row.patterns.map((p) => p.name)).toContain('伤官见官(运成象)');
    expect(row.years.length).toBeGreaterThanOrEqual(9);
    expect(row.best!.score).toBeGreaterThanOrEqual(row.worst!.score);
  });

  it('当前运唯一标记', () => {
    const dp = buildDecadePlan(chart)!;
    expect(dp.rows.filter((r) => r.current)).toHaveLength(1);
  });
});

describe('五行能量计点 buildWuxingEnergy', () => {
  it('藏干集合与引擎 hideGanAttr 逐支一致(表源交叉验证)', () => {
    for (const key of ['year', 'month', 'day', 'time'] as const) {
      const p = chart.pillars[key] as { zhi: string; hideGanAttr?: { gan: string }[] };
      const mine = (ZHI_CANG_POINTS[p.zhi] ?? []).map(([g]) => g);
      const engine = (p.hideGanAttr ?? []).map((h) => h.gan);
      expect(mine, `支${p.zhi} 藏干`).toEqual(engine);
    }
  });

  it('原局层:800点,占比冻结(金25 水35 火17.5 土15 木7.5)', () => {
    const we = buildWuxingEnergy({ pillars: chart.pillars, judge })!;
    const natal = we.layers[0];
    expect(Object.values(natal.points).reduce((a, b) => a + b, 0)).toBe(800);
    expect(natal.percent).toEqual({ 金: 25, 水: 35, 火: 17.5, 土: 15, 木: 7.5 });
    expect(we.groupOf).toEqual({ 金: '比劫', 土: '印枭', 水: '食伤', 木: '财才', 火: '官杀' });
    expect(we.likes).toEqual(expect.arrayContaining(['土', '金'])); // 身弱喜印比之行
  });

  it('岁运叠加:+大运1000点、+流年1200点,各层占比和≈100', () => {
    const we = buildWuxingEnergy({ pillars: chart.pillars, judge, dayunGz: '丙戌', liunianGz: '丙午' })!;
    expect(we.layers.map((l) => l.label)).toEqual(['原局', '+大运丙戌', '+流年丙午']);
    expect(Object.values(we.layers[1].points).reduce((a, b) => a + b, 0)).toBe(1000);
    expect(Object.values(we.layers[2].points).reduce((a, b) => a + b, 0)).toBe(1200);
    for (const l of we.layers) {
      const sum = Object.values(l.percent).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 100)).toBeLessThan(0.35); // 一位小数舍入误差
    }
    // 丙戌+丙午皆火土:火占比逐层抬升
    expect(we.layers[1].percent['火']).toBeGreaterThan(we.layers[0].percent['火']);
    expect(we.layers[2].percent['火']).toBeGreaterThan(we.layers[1].percent['火']);
  });
});

describe('子平真诠原文接入', () => {
  it('八格章节俱全且论/取运非空', () => {
    expect(Object.keys(ZIPING_ZHENQUAN).sort()).toEqual(['伤官', '偏官', '印绶', '建禄月劫', '正官', '阳刃', '财', '食神'].sort());
    for (const [k, c] of Object.entries(ZIPING_ZHENQUAN)) {
      expect(c.lun.length, `${k}.lun`).toBeGreaterThan(100);
      expect(c.quYun.length, `${k}.quYun`).toBeGreaterThan(80);
    }
    expect(ZIPING_ZHENQUAN['阳刃'].lun).toContain('阳刃者');
    expect(ZIPING_ZHENQUAN['建禄月劫'].lun).toContain('建禄者');
  });

  it('格名→章节映射:七杀→偏官、正偏财→财、禄劫变通→建禄月劫', () => {
    expect(geToChapterKey('七杀格')).toBe('偏官');
    expect(geToChapterKey('偏财格')).toBe('财');
    expect(geToChapterKey('正印格')).toBe('印绶');
    expect(geToChapterKey('建禄用正官（变通）')).toBe('建禄月劫');
    expect(geToChapterKey('阳刃格')).toBe('阳刃');
    const classic = getZipingClassic('七杀格')!;
    expect(classic.chapter).toBe('论偏官');
    expect(classic.quYun).toContain('偏官取运');
  });
});

describe('导出集成', () => {
  it('导出含 decadePlan/wuxingEnergy/geJu.classic(懒加载已就绪)', () => {
    const data = buildExportJSON(GOLDEN, chart) as Record<string, any>;
    expect(data.decadePlan.rows.length).toBeGreaterThanOrEqual(10);
    expect(data.decadePlan.dims).toContain('运限格局');
    expect(data.wuxingEnergy.layers[0][0]).toBe('原局');
    expect(data.wuxingEnergy.fuYiLikes).toBeDefined();
    // golden 为七杀格 → 附论偏官原文
    expect(data.geJu.ge).toBe('七杀格');
    expect(data.geJu.classic.chapter).toBe('论偏官');
    expect(data.geJu.classic.lun.length).toBeGreaterThan(300);
  });
});
