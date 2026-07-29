// 格局判定 / 应期预检 / 十二长生 / fanpai 口径修复 的回归测试。
// 期望值手工可证：取格按子平真诠规则逐步推演，长生按阳顺阴逆表推演，
// 应期按引动规则推演；与 mystilight 本命 diShi 交叉验证。
import { describe, it, expect } from 'vitest';
import { calculateBazi, reverseLookupBazi } from '../src/lib/bazi';
import type { BaziInput } from '../src/lib/bazi';
import { analyzeGeJu } from '../src/lib/geju';
import { analyzeYingQi } from '../src/lib/yingqi';
import { getDiShi } from '../src/lib/utils';

const BEIJING: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' };
const CHONGQING: BaziInput = { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 1, city: '重庆' };
const SYDNEY: BaziInput = { year: 1992, month: 12, day: 5, hour: 14, minute: 0, gender: 1, sect: 1, longitude: 151.2, latitude: -33.87, utcOffset: 10 };

describe('格局自动判定（子平真诠机械取格）', () => {
  it('北京盘（辛日午月，午藏丁己皆不透）：以本气取七杀格·凶神逆用，印在时支本气', () => {
    const chart = calculateBazi(BEIJING);
    const g = analyzeGeJu(chart.pillars as any)!;
    expect(g.ge).toBe('七杀格');
    expect(g.type).toBe('凶神逆用');
    expect(g.basis).toContain('皆不透');
    const yin = g.xiangShen.find((x) => x.shiShen === '正印')!;
    expect(yin.status).toContain('藏于时支本气');
    expect(g.jiShen.map((x) => x.shiShen)).toContain('正财');
  });

  it('悉尼盘（乙日亥月，本气壬透年干）：正印格·吉神顺用，相神七杀透干有成格之象', () => {
    const chart = calculateBazi(SYDNEY);
    const g = analyzeGeJu(chart.pillars as any)!;
    expect(g.ge).toBe('正印格');
    expect(g.type).toBe('吉神顺用');
    expect(g.basis).toContain('透于年干');
    expect(g.verdict).toContain('七杀');
    expect(g.verdict).toContain('有成格之象');
  });

  it('重庆盘（己日丑月，本气己比肩当令）：禄刃另论 → 月劫用正官（变通，甲透年干）', () => {
    const chart = calculateBazi(CHONGQING);
    const g = analyzeGeJu(chart.pillars as any)!;
    expect(g.type).toBe('禄刃另论');
    expect(g.ge).toBe('月劫用正官（变通）');
    expect(g.basis).toContain('比肩当令');
  });

  it('用神三法合参：北京盘为「调候主用壬(水)恰为身弱扶抑之忌」的经典相悖案例', async () => {
    const { buildExportJSON } = await import('../src/lib/bazi');
    const chart = calculateBazi(BEIJING);
    const data: any = buildExportJSON(BEIJING, chart);
    const ys = data.yongShen;
    expect(ys.fuYi.note).toContain('身弱喜印比');
    expect(ys.fuYi.yongShen).toContain('土(印)');
    expect(ys.tiaoHou.yongShen[0]).toBe('壬(水)');
    expect(ys.tongGuan.note).toContain('不取');
    expect(ys.heCan).toContain('共取 土');
    expect(ys.heCan).toContain('相悖');
  });

  it('导出集成：buildExportJSON 含 geJu；应期不随导出（仅 MCP query_yingqi 按需查）', async () => {
    const { buildExportJSON } = await import('../src/lib/bazi');
    const chart = calculateBazi(BEIJING);
    const data: any = buildExportJSON(BEIJING, chart);
    expect(data.geJu?.ge).toBe('七杀格');
    // 应期候选年+强度分易被 AI 当预言输出（误报源），已从静态导出剔除；analyzeYingQi 模块保留供 MCP
    expect(data.yingQi).toBeUndefined();
    expect(data.yingQiNote).toBeUndefined();
    // 大运/流年长生字段
    const dy0 = data.dayunArr.find((d: any) => d.ganZhi);
    expect(dy0.diShi).toBeTruthy();
    expect(dy0.liunianArr[0].diShi).toBeTruthy();
  });
});

describe('应期引动预检', () => {
  it('北京男婚恋（正财甲/婚姻宫亥）：2034 甲寅年 = 财星透干 + 寅亥合动婚姻宫', () => {
    const chart = calculateBazi(BEIJING);
    const r = analyzeYingQi(chart, '婚恋', { from: 2026, to: 2040 })!;
    expect(r.starDesc).toContain('正财甲');
    expect(r.palaceDesc).toContain('亥');
    const y2034 = r.hits.find((h) => h.year === 2034)!;
    expect(y2034.ganZhi).toBe('甲寅');
    expect(y2034.reasons.some((x) => x.includes('正财甲透干'))).toBe(true);
    expect(y2034.reasons.some((x) => x.includes('合动婚姻宫'))).toBe(true);
  });

  it('北京男事业（正官丙）：2026 丙午年 = 官星透干 + 丙辛合入日主（强应）+ 杀临太岁', () => {
    const chart = calculateBazi(BEIJING);
    const r = analyzeYingQi(chart, '事业', { from: 2025, to: 2030 })!;
    const y2026 = r.hits.find((h) => h.year === 2026)!;
    expect(y2026.reasons.some((x) => x.includes('正官丙透干'))).toBe(true);
    expect(y2026.reasons.some((x) => x.includes('合入日主'))).toBe(true);
    expect(y2026.reasons.some((x) => x.includes('七杀临太岁'))).toBe(true);
  });

  it('强度排序与门槛：全部命中强度 ≥2 且降序', () => {
    const chart = calculateBazi(BEIJING);
    const r = analyzeYingQi(chart, '财运', { from: 2026, to: 2056 })!;
    expect(r.hits.length).toBeGreaterThan(0);
    for (const h of r.hits) expect(h.strength).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < r.hits.length; i++) expect(r.hits[i - 1].strength).toBeGreaterThanOrEqual(r.hits[i].strength);
  });
});

describe('十二长生（阳顺阴逆）', () => {
  it('查表：甲@亥=长生、辛@酉=临官、辛@亥=沐浴、庚@巳=长生', () => {
    expect(getDiShi('甲', '亥')).toBe('长生');
    expect(getDiShi('辛', '酉')).toBe('临官');
    expect(getDiShi('辛', '亥')).toBe('沐浴');
    expect(getDiShi('庚', '巳')).toBe('长生');
    expect(getDiShi('X', '亥')).toBe('');
  });

  it('与 mystilight 本命地势交叉验证：北京/重庆盘四柱逐一相等', () => {
    for (const input of [BEIJING, CHONGQING]) {
      const chart = calculateBazi(input);
      const dayGan = chart.pillars.day.gan;
      for (const k of ['year', 'month', 'day', 'time'] as const) {
        const p = chart.pillars[k];
        expect(getDiShi(dayGan, p.zhi), `${dayGan}@${p.zhi}`).toBe(p.diShi);
      }
    }
  });
});

describe('fanpai 口径修复', () => {
  it('sect 透传：甲子丁丑己未丙子按传统派可反查到 1985-01-20 晚子时，正统派则无此刻', () => {
    // 该四柱正是重庆例 1985-01-20 23:30 在 sect2（晚子时算当天）下的盘（golden 已锁定）
    const sect2 = reverseLookupBazi('甲子', '丁丑', '己未', '丙子', { sect: 2 });
    expect(sect2.some((r) => r.year === 1985 && r.month === 1 && r.day === 20 && r.hour >= 23)).toBe(true);
    const sect1 = reverseLookupBazi('甲子', '丁丑', '己未', '丙子', { sect: 1 });
    expect(sect1.some((r) => r.year === 1985 && r.month === 1 && r.day === 20 && r.hour >= 23)).toBe(false);
  });

  it('fromYear 突破 60 年硬限：扩大范围仍含 1990 命中（超集行为）', () => {
    const wide = reverseLookupBazi('庚午', '壬午', '辛亥', '壬辰', { sect: 1, fromYear: 1920 });
    expect(wide.some((r) => r.year === 1990 && r.month === 6 && r.day === 15)).toBe(true);
  });
});
