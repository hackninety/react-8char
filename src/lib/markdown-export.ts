/* eslint-disable @typescript-eslint/no-explicit-any --
   引擎 JSON seam 渲染层：上游 d.ts 本身以 any 暴露 yueLing/taiSui 等字段，且两引擎运行时
   形状有漂移（如 shiShenZhi 实为数组，见 docs/Todo 技术债记录）。本层为纯 Markdown 渲染、
   由导出断言（77+ 例）保障；新增非 seam 模块勿沿用此豁免。 */
// 完整命盘 → Markdown（喂 AI 分析用）。
// 相比压缩 JSON，Markdown 结构清晰、字段带中文标签，且额外补充了 JSON 导出未含的
// 「命理分析（喜用神/日时/三命通会）」，便于 AI 更细致地解读。

import { buildExportJSON, generateFileName } from './bazi';
import type { BaziInput, BaziResult } from './bazi';
import { getWuYunLiuQi, buildWuYunLiuQiMarkdown } from './wuyunliuqi';
import { getGanWuXing, getZhiWuXing } from './utils';
import { SHENSHA_POS_CN } from './shensha-dict';
import { AI_ANALYST_ROLE, AI_ANALYSIS_GUIDANCE } from './prompt-template';

const WU_XING_ORDER = ['木', '火', '土', '金', '水'] as const;
const PILLAR_KEYS = ['year', 'month', 'day', 'time'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'];

// 干支关系里柱位标识 → 中文
const REL_PILLAR_LABEL: Record<string, string> = {
  year: '年', month: '月', ri: '日', day: '日', time: '时', daYun: '大运', liuNian: '流年',
};

// Markdown 表格单元格：转义竖线/换行，空值以「—」占位
function td(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  return String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

// 身强/湿度/阴阳等：数字或 { score, judge } 皆可
function scoreJudge(v: any): string {
  if (v == null) return '';
  if (typeof v === 'number') return v.toFixed(2);
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && v.score != null) {
    const s = typeof v.score === 'number' ? v.score.toFixed(2) : String(v.score);
    return v.judge ? `${s}（${v.judge}）` : s;
  }
  return '';
}

// 藏干展开：戊(七杀·本气) 乙(正财·中气) …
function hideGanText(p: any): string {
  if (!Array.isArray(p?.hideGanAttr) || p.hideGanAttr.length === 0) return '—';
  return p.hideGanAttr.map((h: any) => `${h.gan}(${h.shiShen}·${h.qiLevel})`).join(' ');
}

function relFrom(from: string): string {
  if (!from) return '';
  return from.split('+').map((s) => REL_PILLAR_LABEL[s.trim()] || s.trim()).join('+');
}

function relText(rel: any): string {
  if (typeof rel === 'string') return rel;
  if (rel && typeof rel === 'object') {
    const desc = rel.desc ?? '';
    if (rel.from && rel.to) {
      return `${relFrom(rel.from)}↔${REL_PILLAR_LABEL[rel.to] || rel.to} ${desc}`.trim();
    }
    return desc || JSON.stringify(rel);
  }
  return String(rel);
}

// 神煞位置 key → 中文：取自 shensha-dict 的唯一权威映射（引擎结构 { nian/yue/ri/shi, current: {...} }）

function renderShensha(sh: any): string[] {
  const out: string[] = [];
  if (!sh) return out;
  const pushEntry = (key: string, v: unknown) => {
    if (Array.isArray(v)) {
      if (v.length) out.push(`- **${SHENSHA_POS_CN[key] || key}**：${v.join('、')}`);
    } else if (v && typeof v === 'object') {
      // current 之类的嵌套：逐项展开
      for (const [ik, iv] of Object.entries(v)) pushEntry(ik, iv);
    } else if (v != null && v !== '') {
      out.push(`- **${SHENSHA_POS_CN[key] || key}**：${String(v)}`);
    }
  };
  if (Array.isArray(sh)) {
    for (const item of sh) {
      if (item && typeof item === 'object') {
        const name = item.name || item.shen || '';
        const pos = item.position || item.pillar || item.zhi || '';
        const desc = item.desc || item.description || '';
        out.push(`- ${[name, pos, desc].filter(Boolean).join(' · ') || JSON.stringify(item)}`);
      } else {
        out.push(`- ${String(item)}`);
      }
    }
  } else if (typeof sh === 'object') {
    for (const [k, v] of Object.entries(sh)) pushEntry(k, v);
  } else {
    out.push(`- ${String(sh)}`);
  }
  return out;
}

/** 构建完整命盘 Markdown（含 AI 角色设定与分析框架，可直接粘贴给 AI）。 */
export function buildExportMarkdown(input: BaziInput, result: BaziResult): string {
  const data: any = buildExportJSON(input, result);
  const L: string[] = [];
  const push = (...xs: string[]) => L.push(...xs);

  const info = data.input || {};
  const genderCn: string = info.gender === '男' ? '男' : info.gender === '女' ? '女' : String(info.gender ?? '');
  const zaoCn = info.gender === '男' ? '乾造' : info.gender === '女' ? '坤造' : '';
  const sectCn: string = data.meta?.sect || (info.sect === 2 ? '传统派' : '正统派');

  // ── AI 角色设定 + 数据说明 ──
  push(
    AI_ANALYST_ROLE,
    '',
    '数据说明：以下为完整八字命盘数据（Markdown 格式），包含文中各章节的全部盘面信息（四柱/十神/藏干/大运流年含近年流月/五运六气为必备，五行力量/渊海子平/命理分析/神煞及释义/干支关系依引擎能力提供）。其中「调候用神」（含本造《穷通宝鉴》原文段——引用原文以此为准，勿凭记忆补写）「人元司令分野」「格局判定」「用神三法合参」「应期引动预检」「十神组合线索」「盲派象法参考」为确定性查表/预检结果——分析时引用它们，勿凭记忆另查另编。盘面数据流派无关，支持对话中随时切换盲派/调候/滴天髓/格局等视角重新解读（协议见文末）。',
  );
  if (data.aiNote) push('', `> **用户备注**：${data.aiNote}`);
  push('', '---', '');

  // ── 标题 ──
  push('# 八字命盘 · 完整数据', '');
  push(
    `> 工具：${data.meta?.tool ?? '八字排盘 (react-8char)'} · 体系：${data.meta?.system ?? '渊海子平'}${data.meta?.engine ? ` · 引擎：${data.meta.engine}` : ''} · 分派：${sectCn} · 生成时间：${data.meta?.generatedAt ?? ''}`,
    '',
  );

  // ── 基本信息 ──
  push('## 基本信息', '');
  push(`- **性别**：${genderCn}${zaoCn ? `（${zaoCn}）` : ''}`);
  push(`- **出生阳历**：${input.year}年${input.month}月${input.day}日 ${input.hour}时${input.minute}分`);
  push(`- **分派**：${sectCn}`);
  if (info.city) push(`- **出生地**：${info.city}`);
  if (info.livingPlace) push(`- **现居地**：${info.livingPlace}`);
  const st = data.solarTimeInfo;
  if (st?.applied) {
    const at = st.adjustedTime;
    const adj = at ? `，校正后 ${at.year}年${at.month}月${at.day}日 ${at.hour}时${at.minute}分` : '';
    const foreign = st.utcOffset !== undefined && st.utcOffset !== 8;
    const parts = st.longitudeMinutes !== undefined && st.eotMinutes !== undefined
      ? `（${foreign ? '地方时差' : '经度差'} ${st.longitudeMinutes} 分 + 均时差 ${st.eotMinutes} 分）`
      : '';
    const tzNote = foreign ? `，出生地时区 UTC${st.utcOffset >= 0 ? '+' : ''}${st.utcOffset}` : '';
    push(`- **真太阳时**：已校正 ${st.offsetMinutes} 分钟${parts}${tzNote}${adj}（排盘以校正后时刻为准）`);
  }
  push('');

  // ── 双引擎对拍（开启对拍校验时）──
  const ec = data.engineCompare;
  if (ec) {
    push('## 双引擎对拍', '');
    push(`- **对拍引擎**：${ec.engines}`);
    push(`- **结论**：${ec.summary}`);
    if (Array.isArray(ec.diffs) && ec.diffs.length) {
      push('', '| 差异项 | 类型 | 引擎 A | 引擎 B |', '| --- | --- | --- | --- |');
      ec.diffs.forEach((d: any) =>
        push(`| ${td(d.label)} | ${d.kind === 'hard' ? '核心差异' : '流派性差异'} | ${td(d.a)} | ${td(d.b)} |`),
      );
      push('', '> 流派性差异（起运进位/宫位起法口径）属预期，可作为流派研究素材；核心差异需谨慎对待。');
    }
    push('');
  }

  // ── 四柱八字 ──
  const pillars = data.pillars || {};
  push('## 四柱八字', '');
  push('| 柱 | 天干 | 地支 | 天干十神 | 地支十神 | 藏干（十神·气） | 纳音 | 地势 | 自坐 | 旬空 |');
  push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  PILLAR_KEYS.forEach((k, i) => {
    const p = pillars[k];
    if (!p) return;
    const ganWx = getGanWuXing(p.gan);
    const zhiWx = getZhiWuXing(p.zhi);
    const gan = `${td(p.gan)}${ganWx ? `（${ganWx}）` : ''}`;
    const zhi = `${td(p.zhi)}${zhiWx ? `（${zhiWx}）` : ''}`;
    const ganShen = k === 'day' ? '日主' : td(p.shiShenGan);
    push(
      `| ${PILLAR_LABELS[i]}${k === 'day' ? '（日主）' : ''} | ${gan} | ${zhi} | ${ganShen} | ${td(p.shiShenZhi)} | ${td(hideGanText(p))} | ${td(p.naYin)} | ${td(p.diShi)} | ${td(p.ziZuo)} | ${td(p.xunKong)} |`,
    );
  });
  push('');
  if (pillars.dayMasterGan) {
    push(`**日主**：${pillars.dayMasterGan}（${getGanWuXing(pillars.dayMasterGan) || '—'}）`, '');
  }

  // ── 五行力量 ──
  const wx = data.wuXingPower || {};
  const total = WU_XING_ORDER.reduce((s, k) => s + (Number(wx[k]) || 0), 0);
  push('## 五行力量', '');
  push('| 五行 | 力量 | 占比 |', '| --- | --- | --- |');
  WU_XING_ORDER.forEach((k) => {
    const v = Number(wx[k]) || 0;
    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : '0.0';
    push(`| ${k} | ${v.toFixed(2)} | ${pct}% |`);
  });
  push('', `**五行总值**：${total.toFixed(2)}`, '');

  // ── 能量多边形三层占比（宫位轴×原局/+当前大运/+今年流年，干支计点） ──
  const we = data.wuxingEnergy;
  if (we?.layers?.length) {
    push('### 能量多边形（宫位三层占比·岁运叠加）', '');
    push(`> ${we.method}${we.fuYiLikes ? `；扶抑喜行：${we.fuYiLikes.join('、')}` : ''}`, '');
    if (Array.isArray(we.gongWei)) {
      push(`> 宫位轴（六亲星映射）：${we.gongWei.map((g: string[]) => `${g[0]}=${g[1]}(${g[2]})`).join('、')}；${we.gongWeiNote ?? ''}`, '');
    }
    push(`| 层 | ${we.dims.map((d: string) => `${d}·${we.groupOf?.[d] ?? ''}`).join(' | ')} |`, `|${' --- |'.repeat(we.dims.length + 1)}`);
    we.layers.forEach((l: (string | number)[]) => push(`| ${l[0]} | ${l.slice(1).map((v) => `${v}%`).join(' | ')} |`));
    push('');
  }

  // ── 命盘要素 ──
  push('## 命盘要素', '');
  const elem = (label: string, v?: string, ny?: string) => {
    if (v) push(`- **${label}**：${v}${ny ? `（${ny}）` : ''}`);
  };
  elem('胎元', data.taiYuan, data.taiYuanNaYin);
  elem('胎息', data.taiXi, data.taiXiNaYin);
  elem('命宫', data.mingGong, data.mingGongNaYin);
  elem('身宫', data.shenGong, data.shenGongNaYin);
  push('');

  // ── 渊海子平 ──
  const yh = data.yuanHaiZiping;
  if (yh) {
    push('## 渊海子平', '');
    const sj = (label: string, v: any) => {
      const s = scoreJudge(v);
      if (s) push(`- **${label}**：${s}`);
    };
    sj('身强', yh.shenQiang);
    sj('湿度', yh.shidu);
    sj('阴阳', yh.yinyang);

    const yl = yh.yueLing;
    if (yl) {
      push('', '### 月令分析', '');
      if (Array.isArray(yl.tips)) yl.tips.forEach((t: string) => push(`- ${t}`));
      if (yl.summary && typeof yl.summary === 'object') {
        (['year', 'month', 'time'] as const).forEach((kk) => {
          const it = yl.summary[kk];
          if (!it) return;
          const name = kk === 'year' ? '年柱' : kk === 'month' ? '月柱' : '时柱';
          const gods = Array.isArray(it.gods) ? it.gods.flat().join(' ') : '';
          const tags = Array.isArray(it.tags) && it.tags.length ? ` [${it.tags.join(' ')}]` : '';
          const note = it.note ? ` — ${it.note}` : '';
          push(`- **${name}**：${gods}${tags}${note}`);
        });
      }
    }

    const taiSui = yh.taiSui;
    if (taiSui) {
      push('', '### 太岁', '');
      if (taiSui.relation) push(`- **关系**：${taiSui.relation}`);
      if (taiSui.riskLevel) push(`- **风险等级**：${taiSui.riskLevel}`);
      if (Array.isArray(taiSui.details)) taiSui.details.forEach((d: string) => push(`- ${d}`));
    }
    push('');
  }

  // ── 调候用神（穷通宝鉴查表 + 原局得否，确定性数据供 AI 引用）──
  const th = data.tiaoHou;
  if (th) {
    push('## 调候用神（穷通宝鉴）', '');
    push(`- **查表**：${th.dayGan}日主生${th.monthZhi}月 → 调候用神 **${th.gods.join('、')}**（主用在前）`);
    (th.detail ?? []).forEach((d: any) => push(`- **${d.gan}（${d.role}用）**：${d.status}`));
    push(`- **结论**：${th.verdict}`);
    push('', `> ${th.source}`, '');
    if (th.classic) {
      push(`### 《穷通宝鉴》原文（${th.classic.scope}）`, '');
      String(th.classic.text).split('\n').filter((l: string) => l.trim()).forEach((l: string) => push(`> ${l.trim()}`));
      push('', `> —— 录自${th.classic.source}，供调候派分析引用；引用原文以此为准，勿凭记忆补写。`, '');
    }
  }

  // ── 人元司令分野 ──
  const sl = data.siLing;
  if (sl) {
    push('## 人元司令分野', '');
    push(`- ${sl.phase}；交${sl.jie}：${sl.jieTime}（北京时）`);
    push(`- 司令${sl.gan}${sl.wuXing}为日主之**${sl.shiShen}**；${sl.sequence}`);
    if (sl.note) push(`- ⚠ ${sl.note}`);
    push('');
  }

  // ── 格局判定（子平真诠机械取格）──
  const gj = data.geJu;
  if (gj) {
    push('## 格局判定（子平真诠）', '');
    push(`- **格局**：${gj.ge}（${gj.type}）`);
    push(`- **取格**：${gj.basis}`);
    if (Array.isArray(gj.xiangShen) && gj.xiangShen.length) {
      push(`- **相神候选**：${gj.xiangShen.map((x: any) => `${x.shiShen}〔${x.role}〕—${x.status}`).join('；')}`);
    }
    if (Array.isArray(gj.jiShen) && gj.jiShen.length) {
      push(`- **忌神**：${gj.jiShen.map((x: any) => `${x.shiShen}〔${x.role}〕—${x.status}`).join('；')}`);
    }
    push(`- **初判**：${gj.verdict}`);
    if (gj.siLingNote) push(`- ⚠ ${gj.siLingNote}`);
    push('', `> ${gj.source}`, '');
    // 本格《子平真诠》原文（论X + 取运）：分析成败救应时引用经文而非回忆
    if (gj.classic?.lun) {
      push(`### 《子平真诠·${gj.classic.chapter}》原文`, '');
      push(...String(gj.classic.lun).split('\n').map((l: string) => `> ${l}`));
      push('>', `> **${gj.classic.chapter}取运**：`, ...String(gj.classic.quYun ?? '').split('\n').map((l: string) => `> ${l}`));
      push('');
    }
  }

  // ── 用神三法合参 ──
  const ys = data.yongShen;
  if (ys) {
    push('## 用神三法合参', '');
    for (const fa of [ys.fuYi, ys.tiaoHou, ys.tongGuan]) {
      if (!fa) continue;
      push(`- **${fa.fa}**：${fa.yongShen?.length ? fa.yongShen.join('、') : '不取'} —— ${fa.note}`);
    }
    push(`- **合参**：${ys.heCan}`, '');
  }

  // ── 应期引动预检 ──
  const yq = data.yingQi;
  if (Array.isArray(yq) && yq.length) {
    push('## 应期引动预检', '');
    push(`> ${data.yingQiNote ?? '应期为传统引动规则的候选提示，非事件预言'}`, '');
    for (const t of yq) {
      push(`### ${t.topic}（星：${t.star}${t.palace ? `；宫：${t.palace}` : ''}）`, '');
      push('| 年 | 干支 | 强度 | 线索 |', '| --- | --- | --- | --- |');
      (t.hits ?? []).forEach((h: any[]) => push(`| ${h[0]} | ${h[1]} | ${h[2]} | ${td(h[3])} |`));
      push('');
    }
  }

  // ── 十神组合线索（程序预检）──
  const pats = data.patterns;
  if (Array.isArray(pats) && pats.length) {
    push('## 十神组合线索（程序预检）', '');
    push('> 以下为确定性规则检出的经典组合及其落点；吉凶轻重须结合全局与运岁覆核，非既成论断。', '');
    pats.forEach((x: any) => push(`- **${x.name}**［${x.hit}］：${x.note}`));
    push('');
  }

  // ── 盲派象法参考（静态通行类象表，支撑「十神象×宫位象×干支本象」取象）──
  const xf = data.xiangFa;
  if (xf) {
    push('## 盲派象法参考', '');
    push(`> ${xf.note}`, '');
    push('### 十干本象', '');
    Object.entries(xf.gan ?? {}).forEach(([k, v]) => push(`- **${k}**：${v}`));
    push('', '### 十二支本象', '');
    Object.entries(xf.zhi ?? {}).forEach(([k, v]) => push(`- **${k}**：${v}`));
    push('', '### 十神象义', '');
    Object.entries(xf.shiShen ?? {}).forEach(([k, v]) => push(`- **${k}**：${v}`));
    push('');
  }

  // ── 命理分析（喜用神/日时/三命通会，JSON 导出未含，此处补全）──
  const an: any = (result as any).analysis;
  const xiYong = Array.isArray(an?.XiYongShen) ? an.XiYongShen : [];
  const rishi = Array.isArray(an?.rishi) ? an.rishi : [];
  const sanMing = Array.isArray(an?.SanMingTongHui) ? an.SanMingTongHui : [];
  if (xiYong.length || rishi.length || sanMing.length) {
    push('## 命理分析', '');
    if (xiYong.length) push('### 喜用神', '', xiYong.join('、'), '');
    if (rishi.length) {
      push('### 日时分析', '');
      rishi.forEach((s: string) => push(`- ${s}`));
      push('');
    }
    if (sanMing.length) {
      push('### 三命通会', '');
      sanMing.forEach((s: string) => push(`- ${s}`));
      push('');
    }
  }

  // ── 干支关系 ──
  const gr = Array.isArray(data.ganRelations) ? data.ganRelations : [];
  const zr = Array.isArray(data.zhiRelations) ? data.zhiRelations : [];
  if (gr.length || zr.length) {
    push('## 干支关系', '');
    if (gr.length) {
      push('### 天干关系', '');
      gr.forEach((r: any) => push(`- ${relText(r)}`));
      push('');
    }
    if (zr.length) {
      push('### 地支关系', '');
      zr.forEach((r: any) => push(`- ${relText(r)}`));
      push('');
    }
  }

  // ── 神煞（若引擎提供）+ 释义（消除 AI 对冷门神煞的凭记忆编义）──
  const shLines = renderShensha(data.shensha);
  if (shLines.length) {
    push('## 神煞', '', ...shLines, '');
    const dict = data.shenshaDict;
    if (dict && Object.keys(dict).length) {
      push('### 神煞释义', '');
      Object.entries(dict).forEach(([k, v]) => push(`- **${k}**：${v}`));
      push('');
    }
  }

  // ── 五运六气（复用现有 Markdown，标题整体降一级并入本文）──
  const w = getWuYunLiuQi(input);
  if (w) push(buildWuYunLiuQiMarkdown(w).replace(/^#/gm, '##'), '');

  // ── 大运 · 流年 · 流月 ──
  const yun = data.yun;
  const dayunArr: any[] = Array.isArray(data.dayunArr) ? data.dayunArr : [];
  const cy = data.currentYun || {};
  const curDaYunGz = cy.daYun?.ganZhi
    ? Array.isArray(cy.daYun.ganZhi) ? cy.daYun.ganZhi.join('') : cy.daYun.ganZhi
    : null;
  const curLnYear = cy.liuNian?.year;

  push('## 大运流年', '');
  if (yun) push(`> ${yun.forward ? '顺排' : '逆排'} · 起运：${yun.startSolar}`, '');
  if (data.liuYueNote) push(`> ${data.liuYueNote}`, '');

  // 当前岁运格局扫描（当前大运 × 今年流年的确定性命中）
  const yp = data.yunPatterns;
  if (yp?.hits?.length) {
    push(`### 当前岁运格局扫描（大运${yp.dayun}${yp.liunian ? ` · ${yp.year ?? ''}流年${yp.liunian}` : ''}）`, '');
    push(`> ${yp.note}`, '');
    yp.hits.forEach((h: any) => push(`- 【${h.scope}·${h.kind}】**${h.name}**：${h.basis}——${h.meaning}`));
    push('');
  }

  push('### 大运一览', '');
  push('| # | 大运 | 起始年 | 天干十神 | 地支十神 | 日主长生 | 标注 |', '| --- | --- | --- | --- | --- | --- | --- |');
  dayunArr.filter((dy) => dy.ganZhi).forEach((dy, i) => {
    const mark = dy.ganZhi === curDaYunGz ? '当前' : '';
    push(`| ${i + 1} | ${td(dy.ganZhi)} | ${td(dy.startYear)} | ${td(dy.ganshen)} | ${td(dy.zhishen)} | ${td(dy.diShi)} | ${mark} |`);
  });
  push('');

  // 十年规划表（一运一行：喜忌/K线均值/高光低谷/运限格局）
  const dp = data.decadePlan;
  if (dp?.rows?.length) {
    push('### 十年规划表', '');
    push(`> ${dp.note}`, '');
    push(`| ${dp.dims.join(' | ')} |`, `|${' --- |'.repeat(dp.dims.length)}`);
    dp.rows.forEach((r: any[]) => push(`| ${r.map((c) => td(c === '' ? '—' : c)).join(' | ')} |`));
    push('');
  }

  push('### 逐运流年（含流月）', '');
  dayunArr.forEach((dy) => {
    if (!dy.ganZhi) return;
    const mark = dy.ganZhi === curDaYunGz ? ' · 当前' : '';
    push(`#### ${dy.ganZhi} 大运（${dy.startYear}年起${mark}）`, '');
    const lns: any[] = Array.isArray(dy.liunianArr) ? dy.liunianArr : [];
    if (!lns.length) {
      push('');
      return;
    }
    push('| 流年 | 干支 | 天干十神 | 地支十神 | 日主长生 | 标注 |', '| --- | --- | --- | --- | --- | --- |');
    lns.forEach((ln) => {
      const mk = String(ln.year) === String(curLnYear) ? '今年' : '';
      push(`| ${td(ln.year)} | ${td(ln.ganZhi)} | ${td(ln.ganshen)} | ${td(ln.zhishen)} | ${td(ln.diShi)} | ${mk} |`);
    });
    push('');

    const withLy = lns.filter((ln) => Array.isArray(ln.liuYueArr) && ln.liuYueArr.length);
    if (withLy.length) {
      push('<details><summary>流月明细</summary>', '');
      withLy.forEach((ln) => {
        const months = ln.liuYueArr.map((m: any) => `${m.monthName}${m.ganZhi}(${m.shiShen})`).join(' ');
        push(`- **${ln.year} ${ln.ganZhi}**：${months}`);
      });
      push('', '</details>', '');
    }
  });

  // 人生K线量化评分不入导出：简化模型分数易被 AI 锚定为确定结论，反致误报（仅页面展示）

  // ── AI 分析框架 + 多流派视角切换协议 ──
  push('---', '', AI_ANALYSIS_GUIDANCE);

  return L.join('\n');
}

/** 与 JSON 导出同名、扩展名换成 .md */
export function generateMarkdownFileName(input: BaziInput): string {
  return generateFileName(input).replace(/\.json$/, '.md');
}
