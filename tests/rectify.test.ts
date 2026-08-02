// 校对时辰（定盘）回归：十三时辰并排、晚子时换日口径、特征判定、大事年份K线反查。
// 期望值经探针跑出后手工核对冻结（golden 日期 1990-06-15 北京男，校时不作真太阳时校正）。
import { describe, it, expect } from 'vitest';
import { buildHourCandidates, traitHits, matchEvents, scoreCandidate, TRAITS, HOUR_REPRESENTATIVES } from '../src/lib/rectify';
import { calculateBazi, getLiuShiForDay } from '../src/lib/bazi';
import type { BaziInput } from '../src/lib/bazi';

const BASE: BaziInput = { year: 1990, month: 6, day: 15, hour: 0, minute: 0, gender: 1, sect: 1 };

describe('十三时辰并排起盘 buildHourCandidates', () => {
  it('正统派：13 候选,年月柱恒同,晚子时换日(辛亥→壬子)且整盘日主随变', () => {
    const cs = buildHourCandidates(BASE);
    expect(cs).toHaveLength(13);
    expect(cs.map((c) => c.label)).toEqual(HOUR_REPRESENTATIVES.map((t) => t.label));
    // 年月柱恒同；早子~亥日柱同为辛亥
    for (const c of cs) expect(c.pillarsText.startsWith('庚午 壬午')).toBe(true);
    for (const c of cs.slice(0, 12)) {
      expect(c.dayGz).toBe('辛亥');
      expect(c.dayChanged).toBe(false);
    }
    // 晚子时：日柱进次日壬子（换日高亮），时柱庚子（丁壬庚子居）
    const wanZi = cs[12];
    expect(wanZi.pillarsText).toBe('庚午 壬午 壬子 庚子');
    expect(wanZi.dayChanged).toBe(true);
    expect(wanZi.tGanShen).toBe('偏印'); // 庚对壬=偏印（日主已变）
    // 早子时：当日辛日五鼠遁 戊子
    expect(cs[0].timeGz).toBe('戊子');
    // 起运随时辰逐格变化（定盘关键差异列）
    expect(cs[0].qiYun).toContain('1998-01-15');
    expect(cs[11].qiYun).toContain('1997-09-25');
  });

  it('传统派：晚子时日柱不换(仍辛亥),时柱仍入次日子时庚子——两派时干支相同', () => {
    const cs = buildHourCandidates({ ...BASE, sect: 2 });
    const wanZi = cs[12];
    expect(wanZi.pillarsText).toBe('庚午 壬午 辛亥 庚子');
    expect(wanZi.dayChanged).toBe(false);
    expect(wanZi.tGanShen).toBe('劫财'); // 庚对辛=劫财
  });

  it('时柱与流时表 getLiuShiForDay 十三格逐一互证（排盘引擎 × ext 两条路径）', () => {
    const cs = buildHourCandidates(BASE);
    const liuShi = getLiuShiForDay(1990, 6, 15, '辛');
    expect(liuShi).toHaveLength(13);
    cs.forEach((c, i) => {
      expect(c.timeGz, `${c.label} 时柱`).toBe(liuShi[i].ganZhi);
    });
  });
});

describe('特征判定与匹配分', () => {
  it('辰时（时柱壬辰=伤官/正印）命中「口才表达」「书卷气」,不命中桃花', () => {
    const cs = buildHourCandidates(BASE);
    const chen = cs.find((c) => c.label === '辰时')!;
    const hits = traitHits(chen);
    const hitIds = TRAITS.filter((_, i) => hits[i]).map((t) => t.id);
    expect(hitIds).toContain('talk');
    expect(hitIds).toContain('study');
    expect(hitIds).not.toContain('charm'); // 亥日桃花在子,辰不是
  });

  it('酉时（时柱丁酉=七杀/比肩）命中「行动派」「主见强」', () => {
    const cs = buildHourCandidates(BASE);
    const you = cs.find((c) => c.label === '酉时')!;
    const hits = traitHits(you);
    const hitIds = TRAITS.filter((_, i) => hits[i]).map((t) => t.id);
    expect(hitIds).toContain('action'); // 时干丁=七杀
    expect(hitIds).toContain('lead');   // 时支酉本气辛=比肩
  });

  it('匹配分=勾选特征命中×1+大事年份命中×2', () => {
    const hits = [true, false, true, false, false, false, false, false, false, false];
    const checked = new Set(['action', 'talk', 'steady']); // 命中 action/talk,steady 未中
    expect(scoreCandidate(hits, checked, [true, false, true])).toBe(2 + 4);
    expect(scoreCandidate(hits, new Set(), [])).toBe(0);
  });
});

describe('大事年份反查 matchEvents', () => {
  it('北京盘：2034（甲寅,流年入空亡低分年）动荡命中;1991（总分64）好事命中;范围外年份不命中', () => {
    const chart = calculateBazi(BASE);
    const res = matchEvents(chart, [
      { year: 2034, kind: 'turbulent' },
      { year: 1991, kind: 'good' },
      { year: 1800, kind: 'good' },
    ]);
    expect(res).toEqual([true, true, false]);
  });
});
