// TOON 导出回归：无损往返、AI Prompt 围栏、合婚结构化导出、流月K线。
import { describe, it, expect } from 'vitest';
import { decode } from '@toon-format/toon';
import { calculateBazi, buildExportJSON } from '../src/lib/bazi';
import type { BaziInput } from '../src/lib/bazi';
import { toToon, TOON_SYNTAX_HINT } from '../src/lib/toon';
import { generateAIPrompt } from '../src/lib/prompt-template';
import { analyzeHehun, buildHehunExportData } from '../src/lib/hehun';
import { buildMonthKline, KLINE_DIMS } from '../src/lib/lifekline';

const BEIJING: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' };
const CHONGQING: BaziInput = { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 1, city: '重庆' };

describe('TOON 导出', () => {
  it('真实导出数据无损往返（JSON 规范化后 decode 全等）且更紧凑', () => {
    const chart = calculateBazi(BEIJING);
    const data = JSON.parse(JSON.stringify(buildExportJSON(BEIJING, chart)));
    const toon = toToon(data);
    expect(JSON.stringify(decode(toon))).toBe(JSON.stringify(data));
    expect(toon.length).toBeLessThan(JSON.stringify(data).length);
  });

  it('AI Prompt 载荷为 ```toon 围栏并附语法提示，不再是 JSON', () => {
    const chart = calculateBazi(BEIJING);
    const prompt = generateAIPrompt(buildExportJSON(BEIJING, chart));
    expect(prompt).toContain('```toon');
    expect(prompt).not.toContain('```json');
    expect(prompt).toContain(TOON_SYNTAX_HINT);
    expect(prompt).toContain('tiaoHou');
  });

  it('合婚结构化导出：TOON 往返无损，含双方四柱/清单/免责', () => {
    const pa = { label: '甲', input: BEIJING, chart: calculateBazi(BEIJING) };
    const pb = { label: '乙', input: CHONGQING, chart: calculateBazi(CHONGQING) };
    const r = analyzeHehun(pa, pb);
    const data = buildHehunExportData(pa, pb, r);
    const toon = toToon(data);
    const back: any = decode(toon);
    expect(back.a.pillars).toBe('庚午 壬午 辛亥 壬辰');
    expect(back.b.pillars).toBe('甲子 丁丑 己未 乙亥');
    expect(back.items.length).toBe(r.items.length);
    expect(back.meta.disclaimer).toContain('不构成婚姻决策依据');
  });
});

describe('流月K线（单年下钻）', () => {
  it('北京盘 2026：12 个月、OHLC 年内串联、首月开盘=锚点', () => {
    const chart = calculateBazi(BEIJING);
    const anchors = Object.fromEntries(KLINE_DIMS.map((d) => [d.key, 60])) as any;
    const months = buildMonthKline(chart, 2026, anchors)!;
    expect(months).toHaveLength(12);
    expect(months[0].ohlc.total.open).toBe(60);
    for (let i = 1; i < 12; i++) {
      expect(months[i].ohlc.total.open).toBe(months[i - 1].ohlc.total.close);
    }
  });

  it('月度因素确定性：子月冲本命双午、寅卯月入日柱旬空', () => {
    const chart = calculateBazi(BEIJING); // 本命支 午午亥辰，日柱旬空 寅卯
    const months = buildMonthKline(chart, 2026)!;
    const ziMonth = months.find((m) => m.ganZhi.endsWith('子'))!;
    expect(ziMonth.factors.total.some((f) => f.includes('流月冲'))).toBe(true);
    const yinMonth = months.find((m) => m.ganZhi.endsWith('寅'))!;
    const maoMonth = months.find((m) => m.ganZhi.endsWith('卯'))!;
    expect(yinMonth.factors.total.some((f) => f.includes('流月入空亡'))).toBe(true);
    expect(maoMonth.factors.total.some((f) => f.includes('流月入空亡'))).toBe(true);
    // 分数在夹取范围内
    for (const m of months) for (const { key } of KLINE_DIMS) {
      expect(m.scores[key]).toBeGreaterThanOrEqual(5);
      expect(m.scores[key]).toBeLessThanOrEqual(95);
    }
  });

  it('不在流年范围的年份返回 null', () => {
    const chart = calculateBazi(BEIJING);
    expect(buildMonthKline(chart, 1800)).toBeNull();
  });
});
