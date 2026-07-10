// MCP 输出组装：把导出数据组装成紧凑 Markdown（按需查询哲学——摘要给锚点，细节靠追查工具）。
import { getGanWuXing, getZhiWuXing } from '../src/lib/utils';
import { SHENSHA_POS_CN, SHENSHA_PILLAR_KEYS, SHENSHA_CURRENT_KEYS } from '../src/lib/shensha-dict';
import { getShiShen, getLiuYueForYear } from '../src/lib/bazi';
import { createShenShaLookup } from '../src/lib/engine/tyme/shensha';
import type { LifeKlineData, KlineDim } from '../src/lib/lifekline';
import { KLINE_DIMS } from '../src/lib/lifekline';

/* eslint-disable @typescript-eslint/no-explicit-any */

// 地支藏干（本气在前，通行版）——流年支藏干十神展开用
const ZHI_HIDE: Record<string, string> = {
  子: '癸', 丑: '己癸辛', 寅: '甲丙戊', 卯: '乙', 辰: '戊乙癸', 巳: '丙戊庚',
  午: '丁己', 未: '己丁乙', 申: '庚壬戊', 酉: '辛', 戌: '戊辛丁', 亥: '壬甲',
};

const REL_PILLAR: Record<string, string> = { year: '年', month: '月', ri: '日', day: '日', time: '时', daYun: '大运', liuNian: '流年' };

const sj = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'number') return v.toFixed(2);
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.score != null) {
    const s = typeof v.score === 'number' ? v.score.toFixed(2) : String(v.score);
    return v.judge ? `${s}(${v.judge})` : s;
  }
  return '';
};

function relText(rel: any): string {
  if (typeof rel === 'string') return rel;
  if (rel && typeof rel === 'object') {
    const from = rel.from ? String(rel.from).split('+').map((s: string) => REL_PILLAR[s.trim()] || s.trim()).join('+') : '';
    const to = rel.to ? REL_PILLAR[rel.to] || rel.to : '';
    return `${from}${to ? `↔${to}` : ''} ${rel.desc ?? ''}`.trim() || JSON.stringify(rel);
  }
  return String(rel);
}

function hideGanText(p: any): string {
  if (!Array.isArray(p?.hideGanAttr) || !p.hideGanAttr.length) return '—';
  return p.hideGanAttr.map((h: any) => `${h.gan}(${h.shiShen}·${h.qiLevel})`).join(' ');
}

/** 排盘摘要（paipan 工具输出主体）。rawInput 为用户原始输入（data.input 是真太阳时校正后的时刻，回显会误导） */
export function formatPaipanSummary(chartId: string, data: any, chart: any, kline: LifeKlineData | null, rawInput: { year: number; month: number; day: number; hour: number; minute: number }): string {
  const L: string[] = [];
  const info = data.input ?? {};
  const st = data.solarTimeInfo;

  L.push(`# 排盘结果（chartId: \`${chartId}\`）`);
  L.push(`> ${info.gender === '男' ? '乾造' : '坤造'} · 公历 ${rawInput.year}-${rawInput.month}-${rawInput.day} ${rawInput.hour}:${String(rawInput.minute).padStart(2, '0')}` +
    `${info.city ? ` · ${info.city}` : ''} · ${data.meta?.sect ?? ''} · 引擎:${data.meta?.engine ?? data.meta?.system ?? ''}`);
  if (st?.applied) {
    const at = st.adjustedTime;
    L.push(`> 真太阳时已校正 ${st.offsetMinutes} 分（经度差${st.longitudeMinutes}+均时差${st.eotMinutes}）→ 排盘用 ${at?.year}-${at?.month}-${at?.day} ${at?.hour}:${String(at?.minute ?? 0).padStart(2, '0')}${st.utcOffset !== undefined && st.utcOffset !== 8 ? `（出生地 UTC${st.utcOffset >= 0 ? '+' : ''}${st.utcOffset}）` : ''}`);
  }

  // 四柱
  const P = data.pillars ?? {};
  L.push('', '## 四柱', '', '| 柱 | 干支 | 干十神 | 藏干(十神·气) | 纳音 | 地势 | 旬空 |', '|---|---|---|---|---|---|---|');
  (['year', 'month', 'day', 'time'] as const).forEach((k, i) => {
    const p = P[k];
    if (!p) return;
    const label = ['年', '月', '日', '时'][i];
    L.push(`| ${label} | ${p.gan}${p.zhi}(${getGanWuXing(p.gan)}${getZhiWuXing(p.zhi)}) | ${k === 'day' ? '日主' : p.shiShenGan} | ${hideGanText(p)} | ${p.naYin} | ${p.diShi} | ${p.xunKong} |`);
  });

  // 五行/要素/渊海子平
  const wx = data.wuXingPower ?? {};
  const wxLine = ['木', '火', '土', '金', '水'].map((e) => `${e}${Number(wx[e] ?? 0).toFixed(1)}`).join(' ');
  L.push('', `**五行力量**：${wxLine}`);
  L.push(`**命盘要素**：胎元${data.taiYuan ?? '—'} 命宫${data.mingGong ?? '—'} 身宫${data.shenGong ?? '—'}`);
  const yh = data.yuanHaiZiping;
  if (yh) L.push(`**渊海子平**：身强${sj(yh.shenQiang)} 湿度${sj(yh.shidu)} 阴阳${sj(yh.yinyang)}`);
  const an = chart?.analysis;
  if (Array.isArray(an?.XiYongShen) && an.XiYongShen.length) L.push(`**喜用神（引擎）**：${an.XiYongShen.join('、')}`);

  // 调候 / 司令 / 组合
  const th = data.tiaoHou;
  if (th) {
    L.push('', '## 调候用神（穷通宝鉴查表）');
    L.push(`- ${th.dayGan}日主生${th.monthZhi}月 → **${th.gods.join('、')}**（主用在前）`);
    (th.detail ?? []).forEach((d: any) => L.push(`- ${d.gan}（${d.role}）：${d.status}`));
    L.push(`- 结论：${th.verdict}`);
    if (th.classic) {
      L.push(`- 原文（${th.classic.scope}，录自${th.classic.source}；引用以此为准）：${String(th.classic.text).replace(/\n+/g, ' ')}`);
    }
  }
  const sl = data.siLing;
  if (sl) {
    L.push('', '## 人元司令');
    L.push(`- ${sl.phase}；司令${sl.gan}为日主之**${sl.shiShen}**；${sl.sequence}${sl.note ? `；⚠ ${sl.note}` : ''}`);
  }
  const gj = data.geJu;
  if (gj) {
    L.push('', '## 格局判定（子平真诠机械取格）');
    L.push(`- **${gj.ge}**（${gj.type}）——${gj.basis}`);
    if (Array.isArray(gj.xiangShen) && gj.xiangShen.length) L.push(`- 相神候选：${gj.xiangShen.map((x: any) => `${x.shiShen}〔${x.role}〕${x.status}`).join('；')}`);
    if (Array.isArray(gj.jiShen) && gj.jiShen.length) L.push(`- 忌神：${gj.jiShen.map((x: any) => `${x.shiShen}〔${x.role}〕${x.status}`).join('；')}`);
    L.push(`- 初判：${gj.verdict}${gj.siLingNote ? `；⚠ ${gj.siLingNote}` : ''}`);
  }
  if (Array.isArray(data.patterns) && data.patterns.length) {
    L.push('', '## 十神组合线索（程序预检，吉凶须结合全局覆核）');
    data.patterns.forEach((x: any) => L.push(`- **${x.name}**［${x.hit}］：${x.note}`));
  }

  // 神煞（位置标签取自 shensha-dict 权威映射）
  const sh = data.shensha;
  if (sh) {
    L.push('', '## 神煞');
    const seg = (label: string, arr: unknown) => { if (Array.isArray(arr) && arr.length) L.push(`- ${label}：${arr.join('、')}`); };
    for (const k of SHENSHA_PILLAR_KEYS) seg(SHENSHA_POS_CN[k], sh[k]);
    if (sh.current) for (const k of SHENSHA_CURRENT_KEYS) seg(SHENSHA_POS_CN[k], sh.current[k]);
    const dict = data.shenshaDict;
    if (dict && Object.keys(dict).length) {
      L.push('', '**释义**：' + Object.entries(dict).map(([k, v]) => `${k}=${v}`).join('；'));
    }
  }

  // 干支关系
  const gr = Array.isArray(data.ganRelations) ? data.ganRelations : [];
  const zr = Array.isArray(data.zhiRelations) ? data.zhiRelations : [];
  if (gr.length || zr.length) {
    L.push('', '## 干支关系');
    if (gr.length) L.push(`- 天干：${gr.map(relText).join('；')}`);
    if (zr.length) L.push(`- 地支：${zr.map(relText).join('；')}`);
  }

  // 命理分析文本（引擎断语，原文引用级素材）
  const rishi = Array.isArray(an?.rishi) ? an.rishi : [];
  const sanMing = Array.isArray(an?.SanMingTongHui) ? an.SanMingTongHui : [];
  if (rishi.length || sanMing.length) {
    L.push('', '## 引擎断语');
    rishi.forEach((s: string) => L.push(`- [日时] ${s}`));
    sanMing.forEach((s: string) => L.push(`- [三命通会] ${s}`));
  }

  // 大运一览 + 当前运岁
  const dayunArr: any[] = Array.isArray(data.dayunArr) ? data.dayunArr : [];
  const cy = data.currentYun ?? {};
  const curDy = cy.daYun?.ganZhi ? (Array.isArray(cy.daYun.ganZhi) ? cy.daYun.ganZhi.join('') : cy.daYun.ganZhi) : '';
  if (dayunArr.length) {
    L.push('', '## 大运一览', '', `> ${data.yun?.forward ? '顺排' : '逆排'} · 起运 ${data.yun?.startSolar ?? ''}`, '');
    L.push('| 大运 | 起始年 | 干神 | 支神 | 日主长生 | |', '|---|---|---|---|---|---|');
    dayunArr.filter((d) => d.ganZhi).forEach((d) => {
      L.push(`| ${d.ganZhi} | ${d.startYear} | ${d.ganshen ?? ''} | ${d.zhishen ?? ''} | ${d.diShi ?? ''} | ${d.ganZhi === curDy ? '←当前' : ''} |`);
    });
    if (cy.liuNian?.year) L.push('', `**当前流年**：${cy.liuNian.year} ${Array.isArray(cy.liuNian.ganZhi) ? cy.liuNian.ganZhi.join('') : cy.liuNian.ganZhi}`);
  }

  // K线速览
  if (kline) {
    L.push('', '## 人生K线速览（简化量化模型，供参考）');
    L.push(`- 身强弱判定：**${kline.judge}**（${kline.judgeSource}；${kline.preferenceNote}）`);
    if (kline.dili.hasLocation) L.push(`- 地利：${kline.dili.note}`);
    if (kline.decades.length) L.push(`- 大运总运均分：${kline.decades.map((d) => `${d.ganZhi}${d.avg.total}`).join(' ')}`);
    const sorted = [...kline.years].sort((a, b) => b.scores.total - a.scores.total);
    L.push(`- 峰值年：${sorted.slice(0, 3).map((y) => `${y.year}${y.ganZhi}(${y.scores.total})`).join(' ')}`);
    L.push(`- 低谷年：${sorted.slice(-3).reverse().map((y) => `${y.year}${y.ganZhi}(${y.scores.total})`).join(' ')}`);
  }

  L.push('', '---', `后续：\`query_year\`(chartId+年份)查单年详情；\`query_yingqi\`查婚恋/事业/财运应期候选；\`query_liuyue\`/\`query_liuri\`查流月流日；\`get_kline\`查五维评分全貌；\`query_wuyunliuqi\`查五运六气。`);
  return L.join('\n');
}

/** 单年详情（query_year 工具输出） */
export function formatYearDetail(data: any, kline: LifeKlineData | null, year: number): string {
  const dayunArr: any[] = Array.isArray(data.dayunArr) ? data.dayunArr : [];
  let dy: any = null;
  let ln: any = null;
  for (const d of dayunArr) {
    const hit = d.liunianArr?.find((x: any) => x.year === year);
    if (hit) { dy = d; ln = hit; break; }
  }
  if (!ln) return `错误：${year} 年不在本盘大运流年范围内`;

  const L: string[] = [];
  const dayGan = data.pillars?.dayMasterGan || data.pillars?.day?.gan || '';
  const lnGan = ln.ganZhi?.[0] ?? '';
  const lnZhi = ln.ganZhi?.[1] ?? '';
  const kY = kline?.years.find((y) => y.year === year);
  const age = kY?.age;

  L.push(`# ${year} 年（${ln.ganZhi}${age ? ` · ${age}岁` : ''}）`);
  L.push(`- 所处大运：${dy.ganZhi ? `**${dy.ganZhi}**（${dy.startYear}年起，干${dy.ganshen ?? '—'}/支${dy.zhishen ?? '—'}）` : '起运前'}`);
  const hide = (ZHI_HIDE[lnZhi] ?? '').split('').filter(Boolean)
    .map((g) => `${g}(${getShiShen(dayGan, g)})`).join(' ');
  L.push(`- 流年十神：干${lnGan}=${getShiShen(dayGan, lnGan) || ln.ganshen || '—'}；支${lnZhi}藏 ${hide}${ln.diShi ? `；日主于${lnZhi}为「${ln.diShi}」` : ''}`);

  // 流年神煞（按本命定盘查）
  const P = data.pillars;
  if (P?.year && P?.day) {
    const lookup = createShenShaLookup(
      { year: P.year, month: P.month, day: P.day, time: P.time },
      P.day.xunKong || '',
    );
    const ss = lookup({ gan: lnGan, zhi: lnZhi });
    if (ss.length) L.push(`- 流年神煞：${ss.join('、')}`);
  }

  // K线五维 + 因素明细（模型的确定性归因）
  if (kY) {
    L.push('', '## K线评分（0-100，简化模型）');
    L.push('| 维度 | 分 | 较上年 | 因素 |', '|---|---|---|---|');
    for (const { key, label } of KLINE_DIMS) {
      const d = key as KlineDim;
      L.push(`| ${label} | ${kY.scores[d]} | ${kY.delta[d] > 0 ? '+' : ''}${kY.delta[d]} | ${kY.factors[d].join('、') || '平'} |`);
    }
  }

  // 流月
  if (lnGan && dayGan) {
    const months = getLiuYueForYear(lnGan, dayGan);
    if (months.length) {
      L.push('', '## 流月', '', months.map((m) => `${m.monthName}${m.ganZhi}(${m.shiShen})`).join(' '));
    }
  }
  L.push('', `> 需逐日择日可用 \`query_liuri\`（chartId + year + month 序号，1=正月寅）`);
  return L.join('\n');
}

/** K线全貌（get_kline 工具输出） */
export function formatKlineOverview(kline: LifeKlineData, series: boolean): string {
  const L: string[] = [];
  L.push('# 人生K线（五维 0-100，简化扶抑量化模型，仅供参考）');
  L.push(`- 判定：**${kline.judge}**（${kline.judgeSource}）；${kline.preferenceNote}；性别${kline.gender}`);
  if (kline.dili.hasLocation) L.push(`- 地利：${kline.dili.note}`);
  L.push('', '## 大运各维均分', '', '| 大运 | 起止 | 总 | 事业 | 财 | 情 | 健 |', '|---|---|---|---|---|---|---|');
  kline.decades.forEach((d) => {
    L.push(`| ${d.ganZhi} | ${d.startYear}~${d.endYear} | ${d.avg.total} | ${d.avg.career} | ${d.avg.wealth} | ${d.avg.love} | ${d.avg.health} |`);
  });
  const sorted = [...kline.years].sort((a, b) => b.scores.total - a.scores.total);
  const line = (y: typeof kline.years[number]) =>
    `- ${y.year}${y.ganZhi}(${y.age}岁) 总${y.scores.total} 事${y.scores.career} 财${y.scores.wealth} 情${y.scores.love} 健${y.scores.health}｜${y.factors.total.join('、') || '平'}`;
  L.push('', '## 总运峰值 TOP5');
  sorted.slice(0, 5).forEach((y) => L.push(line(y)));
  L.push('', '## 总运低谷 TOP5');
  sorted.slice(-5).reverse().forEach((y) => L.push(line(y)));
  if (series) {
    L.push('', '## 逐年总分序列');
    L.push(kline.years.map((y) => `${y.year}:${y.scores.total}`).join(' '));
  }
  L.push('', '> 单年五维因素明细用 `query_year` 查询。');
  return L.join('\n');
}
