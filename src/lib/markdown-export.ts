// 完整命盘 → Markdown（喂 AI 分析用）。
// 相比压缩 JSON，Markdown 结构清晰、字段带中文标签，且额外补充了 JSON 导出未含的
// 「命理分析（喜用神/日时/三命通会）」，便于 AI 更细致地解读。

import { buildExportJSON, generateFileName } from './bazi';
import type { BaziInput, BaziResult } from './bazi';
import { getWuYunLiuQi, buildWuYunLiuQiMarkdown } from './wuyunliuqi';
import { getGanWuXing, getZhiWuXing } from './utils';
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

// 神煞位置 key → 中文（mystilight 实际结构：{ nian/yue/ri/shi: string[], current: { daYun/liuNian/liuYue: string[] } }）
const SHENSHA_KEY_CN: Record<string, string> = {
  nian: '年柱', yue: '月柱', ri: '日柱', shi: '时柱',
  daYun: '当前大运', liuNian: '当前流年', liuYue: '当前流月', liuRi: '当前流日',
};

function renderShensha(sh: any): string[] {
  const out: string[] = [];
  if (!sh) return out;
  const pushEntry = (key: string, v: unknown) => {
    if (Array.isArray(v)) {
      if (v.length) out.push(`- **${SHENSHA_KEY_CN[key] || key}**：${v.join('、')}`);
    } else if (v && typeof v === 'object') {
      // current 之类的嵌套：逐项展开
      for (const [ik, iv] of Object.entries(v)) pushEntry(ik, iv);
    } else if (v != null && v !== '') {
      out.push(`- **${SHENSHA_KEY_CN[key] || key}**：${String(v)}`);
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
    '数据说明：以下为完整八字命盘数据（Markdown 格式），包含文中各章节的全部盘面信息（四柱/十神/藏干/大运流年含流月/五运六气为必备，五行力量/渊海子平/命理分析/神煞/干支关系依引擎能力提供），请充分利用全部信息进行分析。盘面数据流派无关，支持对话中随时切换盲派/调候/格局等视角重新解读（协议见文末）。',
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

  // ── 神煞（若引擎提供）──
  const shLines = renderShensha(data.shensha);
  if (shLines.length) push('## 神煞', '', ...shLines, '');

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

  push('### 大运一览', '');
  push('| # | 大运 | 起始年 | 天干十神 | 地支十神 | 标注 |', '| --- | --- | --- | --- | --- | --- |');
  dayunArr.filter((dy) => dy.ganZhi).forEach((dy, i) => {
    const mark = dy.ganZhi === curDaYunGz ? '当前' : '';
    push(`| ${i + 1} | ${td(dy.ganZhi)} | ${td(dy.startYear)} | ${td(dy.ganshen)} | ${td(dy.zhishen)} | ${mark} |`);
  });
  push('');

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
    push('| 流年 | 干支 | 天干十神 | 地支十神 | 标注 |', '| --- | --- | --- | --- | --- |');
    lns.forEach((ln) => {
      const mk = String(ln.year) === String(curLnYear) ? '今年' : '';
      push(`| ${td(ln.year)} | ${td(ln.ganZhi)} | ${td(ln.ganshen)} | ${td(ln.zhishen)} | ${mk} |`);
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

  // ── AI 分析框架 + 多流派视角切换协议 ──
  push('---', '', AI_ANALYSIS_GUIDANCE);

  return L.join('\n');
}

/** 与 JSON 导出同名、扩展名换成 .md */
export function generateMarkdownFileName(input: BaziInput): string {
  return generateFileName(input).replace(/\.json$/, '.md');
}
