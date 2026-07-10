// 分析模块回归测试：调候/司令/组合预检/神煞词典/地利/人生K线/流月/导出结构。
// 期望值均经本轮开发中逐项手工核对（见 docs/Todo.md 2026-07 条目），冻结防回归。
import { describe, it, expect } from 'vitest';
import { calculateBazi, buildExportJSON, getLiuYueForYear } from '../src/lib/bazi';
import type { BaziInput } from '../src/lib/bazi';
import { getTiaoHouGods, analyzeTiaoHou } from '../src/lib/tiaohou';
import { computeSiLing } from '../src/lib/siling';
import { detectPatterns } from '../src/lib/patterns';
import { lookupShenShaMeanings } from '../src/lib/shensha-dict';
import { computeDiLi } from '../src/lib/dili';
import { buildLifeKline } from '../src/lib/lifekline';

const BEIJING: BaziInput = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 1, city: '北京' };
const CHONGQING: BaziInput = { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 1, city: '重庆' };
const SYDNEY: BaziInput = { year: 1992, month: 12, day: 5, hour: 14, minute: 0, gender: 1, sect: 1, longitude: 151.2, latitude: -33.87, utcOffset: 10 };

describe('调候用神（穷通宝鉴查表）', () => {
  it('查表：甲寅=丙癸、辛午=壬己癸、癸巳=辛、乙子=丙', () => {
    expect(getTiaoHouGods('甲', '寅')).toEqual(['丙', '癸']);
    expect(getTiaoHouGods('辛', '午')).toEqual(['壬', '己', '癸']);
    expect(getTiaoHouGods('癸', '巳')).toEqual(['辛']);
    expect(getTiaoHouGods('乙', '子')).toEqual(['丙']);
    expect(getTiaoHouGods('甲', 'X')).toBeNull();
  });
  it('原局得否：北京盘（辛午月）主用壬透月/时干 → 调候得力', () => {
    const chart = calculateBazi(BEIJING);
    const th = analyzeTiaoHou(chart.pillars as any)!;
    expect(th.gods).toEqual(['壬', '己', '癸']);
    expect(th.detail[0].strength).toBe(2);
    expect(th.detail[0].status).toContain('透于月干、时干');
    expect(th.verdict).toContain('调候得力');
  });
});

describe('人元司令分野', () => {
  it('北京盘：芒种后第 10 日，丙火司令（正官）', () => {
    const sl = computeSiLing({ year: 1990, month: 6, day: 15, hour: 8, minute: 30 }, '辛')!;
    expect(sl.jie).toBe('芒种');
    expect(sl.dayN).toBe(10);
    expect(sl.gan).toBe('丙');
    expect(sl.shiShen).toBe('正官');
  });
  it('重庆盘：小寒后第 16 日，己土司令（比肩）', () => {
    const sl = computeSiLing({ year: 1985, month: 1, day: 20, hour: 23, minute: 30 }, '己')!;
    expect(sl.jie).toBe('小寒');
    expect(sl.dayN).toBe(16);
    expect(sl.gan).toBe('己');
    expect(sl.shiShen).toBe('比肩');
  });
  it('悉尼盘（UTC+10 换算北京时）：立冬后第 29 日，壬水司令', () => {
    const sl = computeSiLing({ year: 1992, month: 12, day: 5, hour: 14, minute: 0, utcOffset: 10 }, '乙')!;
    expect(sl.jie).toBe('立冬');
    expect(sl.dayN).toBe(29);
    expect(sl.gan).toBe('壬');
  });
  it('交界提示：立春后数小时出生 → 司令归属敏感提示', () => {
    const sl = computeSiLing({ year: 2000, month: 2, day: 4, hour: 22, minute: 0 }, '甲')!;
    expect(sl.jie).toBe('立春');
    expect(sl.dayN).toBe(1);
    expect(sl.gan).toBe('戊');
    expect(sl.note).toContain('交界');
  });
});

describe('十神组合预检', () => {
  const patternsOf = (input: BaziInput) => {
    const chart = calculateBazi(input);
    const kline = buildLifeKline(chart);
    return detectPatterns(chart.pillars as any, { judge: kline?.judge, wuXingPower: chart.wuXingPower as any }).map((p) => p.name);
  };
  it('北京盘：伤官驾杀/杀印相生/伤官配印/孤鸾煞，且无官杀混杂', () => {
    const names = patternsOf(BEIJING);
    expect(names).toEqual(expect.arrayContaining(['伤官驾杀', '杀印相生', '伤官配印', '孤鸾煞']));
    expect(names).not.toContain('官杀混杂');
  });
  it('重庆盘（身弱）：官杀混杂/比劫争财/财滋七杀攻身/贪财坏印/杀重身轻', () => {
    const names = patternsOf(CHONGQING);
    expect(names).toEqual(expect.arrayContaining(['官杀混杂', '比劫争财', '财滋七杀攻身', '贪财坏印', '杀重身轻']));
  });
  it('悉尼盘：三奇贵人(散)（壬癸辛俱全不顺布）与官印相生', () => {
    const names = patternsOf(SYDNEY);
    expect(names).toEqual(expect.arrayContaining(['三奇贵人(散)', '官印相生', '杀印相生']));
  });
  it('支本气十神参与检测（mystilight shiShenZhi 为数组的兼容）', () => {
    // 重庆盘的正财只在时支本气（亥藏壬）——若数组形状未兼容，比劫争财不会命中
    const names = patternsOf(CHONGQING);
    expect(names).toContain('比劫争财');
  });
});

describe('神煞词典', () => {
  it('剥基准后缀查表，未知名不编义', () => {
    const d = lookupShenShaMeanings(['天乙贵人(日)', '空亡(年)', '不存在的煞']);
    expect(Object.keys(d).sort()).toEqual(['天乙贵人', '空亡']);
    expect(d['天乙贵人']).toContain('贵人');
  });
});

describe('地利方位', () => {
  it('悉尼（南纬）：纬度取绝对值 → 南北适中、方向加成归零、附南半球倒季提示', () => {
    const r = computeDiLi({ dayWuXing: '木', judge: '身弱', monthZhi: '子', gender: '男', latitude: -33.87, longitude: 151.2 });
    expect(r.note).toContain('南北适中');
    expect(r.note).toContain('南半球');
    expect(r.offsets.total).toBe(0);
  });
  it('纽约（西经）：东西轴中性化（不再套中国本位），仅保寒热轴', () => {
    const r = computeDiLi({ dayWuXing: '火', judge: '身强', monthZhi: '卯', gender: '女', latitude: 40.7, longitude: -74.0 });
    expect(r.note).toContain('偏北(寒)');
    expect(r.note).not.toMatch(/偏东|偏西/);
  });
  it('广州（国内）：行为不变——偏南偏东、地利平平、无南半球提示', () => {
    const r = computeDiLi({ dayWuXing: '木', judge: '身弱', monthZhi: '子', gender: '男', latitude: 23.1, longitude: 113.3 });
    expect(r.note).toContain('偏南(暖)偏东');
    expect(r.note).toContain('地利平平');
    expect(r.note).not.toContain('南半球');
  });
});

describe('人生K线', () => {
  it('北京盘：身弱（渊海子平）；剥掉渊海子平走简化扶抑仍判身弱', () => {
    const chart = calculateBazi(BEIJING);
    const k1 = buildLifeKline(chart)!;
    expect(k1.judge).toBe('身弱');
    expect(k1.judgeSource).toBe('渊海子平');
    const stripped = { ...chart } as any;
    delete stripped.yuanHaiZiping;
    const k2 = buildLifeKline(stripped)!;
    expect(k2.judge).toBe('身弱');
    expect(k2.judgeSource).toBe('简化扶抑');
  });
  it('悉尼盘：乙卯大运遇乙卯日柱 → 大运伏吟日柱计入该运每一年', () => {
    const chart = calculateBazi(SYDNEY);
    const k = buildLifeKline(chart)!;
    const yearsInYiMao = k.years.filter((y) => y.dayun === '乙卯');
    expect(yearsInYiMao.length).toBeGreaterThan(0);
    for (const y of yearsInYiMao) {
      expect(y.factors.total.some((f) => f.includes('大运伏吟日柱'))).toBe(true);
    }
  });
  it('北京盘 2026 丙午年：流年干合日干（丙辛合）计入因素', () => {
    const chart = calculateBazi(BEIJING);
    const k = buildLifeKline(chart)!;
    const y2026 = k.years.find((y) => y.year === 2026)!;
    expect(y2026.ganZhi).toBe('丙午');
    expect(y2026.factors.total.some((f) => f.includes('流年干合日干'))).toBe(true);
  });
  it('三合成局：北京盘 2008 戊子（大运申+本命辰+流年子）会齐申子辰水局；午月燥命同年得子水润燥', () => {
    const k = buildLifeKline(calculateBazi(BEIJING))!;
    const y = k.years.find((x) => x.year === 2008)!;
    expect(y.dayun).toBe('甲申');
    expect(y.factors.total.some((f) => f.includes('流年会齐申子辰水局(忌)'))).toBe(true);
    expect(y.factors.total.some((f) => f.includes('润济燥局'))).toBe(true);
  });
  it('成局+空亡并发：北京盘 2034 甲寅（大运戌+本命午）会齐寅午戌火局，寅落日柱旬空无冲则虚耗', () => {
    const k = buildLifeKline(calculateBazi(BEIJING))!;
    const y = k.years.find((x) => x.year === 2034)!;
    expect(y.factors.total.some((f) => f.includes('流年会齐寅午戌火局(忌)'))).toBe(true);
    expect(y.factors.total.some((f) => f.includes('流年入空亡'))).toBe(true);
  });
  it('冲空反实：北京盘 2010 庚寅寅落空亡但冲大运申 → 不罚反实', () => {
    const k = buildLifeKline(calculateBazi(BEIJING))!;
    const y = k.years.find((x) => x.year === 2010)!;
    expect(y.factors.total.some((f) => f.includes('冲空反实'))).toBe(true);
    expect(y.factors.total.some((f) => f.includes('流年入空亡'))).toBe(false);
  });
  it('冲空反实（本命冲）：重庆盘 1997 丁丑，丑落空亡被本命未支冲解', () => {
    const k = buildLifeKline(calculateBazi(CHONGQING))!;
    const y = k.years.find((x) => x.year === 1997)!;
    expect(y.factors.total.some((f) => f.includes('冲空反实'))).toBe(true);
  });
  it('三会成方（喜）：重庆盘 2062 壬午（大运巳+本命未）会齐巳午未南方火会，寒命火印为喜', () => {
    const k = buildLifeKline(calculateBazi(CHONGQING))!;
    const y = k.years.find((x) => x.year === 2062)!;
    expect(y.dayun).toBe('己巳');
    expect(y.factors.total.some((f) => f.includes('流年会齐巳午未南方火会(喜)'))).toBe(true);
  });
});

describe('流月（五虎遁）与导出结构', () => {
  it('丙年正月起庚寅（丙辛必定寻庚起），庚对辛日主为劫财', () => {
    const months = getLiuYueForYear('丙', '辛');
    expect(months).toHaveLength(12);
    expect(months[0].ganZhi).toBe('庚寅');
    expect(months[0].shiShen).toBe('劫财');
    expect(months[11].ganZhi).toBe('辛丑');
  });
  it('导出含 AI 锚定字段；流月仅展开当前前后年份窗口', () => {
    const chart = calculateBazi(BEIJING);
    const data: any = buildExportJSON(BEIJING, chart);
    expect(data.tiaoHou?.gods).toEqual(['壬', '己', '癸']);
    expect(data.siLing?.gan).toBe('丙');
    expect(Array.isArray(data.patterns) && data.patterns.length).toBeTruthy();
    expect(Object.keys(data.shenshaDict ?? {}).length).toBeGreaterThan(5);
    expect(data.liuYueNote).toContain('五虎遁');

    const nowYear = new Date().getFullYear();
    let expanded = 0;
    for (const dy of data.dayunArr ?? []) {
      for (const ln of dy.liunianArr ?? []) {
        const has = Array.isArray(ln.liuYueArr) && ln.liuYueArr.length > 0;
        if (has) {
          expanded++;
          expect(ln.year).toBeGreaterThanOrEqual(nowYear - 1);
          expect(ln.year).toBeLessThanOrEqual(nowYear + 4);
        }
      }
    }
    expect(expanded).toBeGreaterThan(0);
    expect(expanded).toBeLessThanOrEqual(6);
  });
});
