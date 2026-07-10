// 合婚对照回归测试：确定性互动清单（北京男 辛亥日庚午年 × 重庆女 己未日甲子年）。
// 期望值手工推演可证：年支午子相冲、日支亥未同属亥卯未三合（半合）、
// 日干己土生辛金（B 为 A 之偏印、A 为 B 之食神）。
import { describe, it, expect } from 'vitest';
import { calculateBazi } from '../src/lib/bazi';
import type { BaziInput } from '../src/lib/bazi';
import { analyzeHehun, buildHehunMarkdown } from '../src/lib/hehun';

const BEIJING: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' };
const CHONGQING: BaziInput = { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 1, city: '重庆' };

function pair() {
  const ca = calculateBazi(BEIJING);
  const cb = calculateBazi(CHONGQING);
  const pa = { label: '甲', input: BEIJING, chart: ca };
  const pb = { label: '乙', input: CHONGQING, chart: cb };
  return { pa, pb, r: analyzeHehun(pa, pb) };
}

describe('合婚对照', () => {
  it('年支属相：午子相冲（忌，注明民俗弱化）', () => {
    const { r } = pair();
    const it_ = r.items.find((x) => x.aspect === '年支属相')!;
    expect(it_.finding).toContain('相冲');
    expect(it_.polarity).toBe('忌');
    expect(it_.note).toContain('弱化');
  });

  it('婚姻宫：亥未半三合（吉）', () => {
    const { r } = pair();
    const it_ = r.items.find((x) => x.aspect === '婚姻宫互动')!;
    expect(it_.finding).toContain('半三合');
    expect(it_.polarity).toBe('吉');
  });

  it('日干互动与互为十神：己土生辛金；乙为甲之偏印、甲为乙之食神', () => {
    const { r } = pair();
    const gan = r.items.find((x) => x.aspect === '日干互动')!;
    expect(gan.finding).toContain('己');
    expect(gan.finding).toContain('生');
    expect(gan.polarity).toBe('吉');
    const ss = r.items.find((x) => x.aspect === '互为十神')!;
    expect(ss.finding).toContain('偏印');
    expect(ss.finding).toContain('食神');
  });

  it('双向条目齐备：喜用互补两条、计数一致、无总分', () => {
    const { r } = pair();
    expect(r.items.filter((x) => x.aspect === '喜用互补').length).toBe(2);
    const total = r.counts['吉'] + r.counts['平'] + r.counts['忌'];
    expect(total).toBe(r.items.length);
    expect(JSON.stringify(r)).not.toContain('总分');
  });

  it('Markdown 导出：含双盘四柱、免责声明与分析框架、纪律', () => {
    const { pa, pb, r } = pair();
    const md = buildHehunMarkdown(pa, pb, r);
    expect(md).toContain('庚午 壬午 辛亥 壬辰');
    expect(md).toContain('甲子 丁丑 己未 乙亥');
    expect(md).toContain('不构成婚姻决策依据');
    expect(md).toContain('分析框架');
    expect(md).toContain('置信度');
  });
});
