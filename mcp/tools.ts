// MCP 工具集：把排盘引擎暴露为按需查询的工具（stdio 传输）。
// 设计：paipan 返回紧凑摘要 + chartId（进程内 LRU 缓存），后续 query_* 凭 chartId 深挖，
// AI 无需一次性吞完整导出——交互式按需查询优于更大的静态上下文。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import type { BaziInput } from '../src/lib/bazi';
import { buildExportJSON, getLiuYueForYear, getLiuRiForMonth, reverseLookupBazi, TIAN_GAN, DI_ZHI, JIA_ZI_60 } from '../src/lib/bazi';
import { calculateChart, compareEngines } from '../src/lib/engine';
import { buildLifeKline, type LifeKlineData } from '../src/lib/lifekline';
import { getTiaoHouGods } from '../src/lib/tiaohou';
import { getWuYunLiuQi, buildWuYunLiuQiMarkdown } from '../src/lib/wuyunliuqi';
import { getCityByName, findLatitude } from '../src/lib/cities';
import { formatPaipanSummary, formatYearDetail, formatKlineOverview } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── 命盘缓存（LRU）────────────────────────────────────

interface CachedChart {
  input: BaziInput;
  chart: any;
  data: any; // buildExportJSON 结果
  kline: LifeKlineData | null;
}

const CACHE_MAX = 20;
const cache = new Map<string, CachedChart>();

function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function chartIdOf(i: BaziInput): string {
  const key = [i.year, i.month, i.day, i.hour, i.minute, i.gender, i.sect, i.city ?? '', i.longitude ?? '', i.latitude ?? '', i.utcOffset ?? '', i.engine ?? 'mystilight'].join('|');
  return `bz-${fnv1a(key)}`;
}

function putCache(id: string, v: CachedChart) {
  if (cache.has(id)) cache.delete(id);
  cache.set(id, v);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

function getCache(id: string): CachedChart | undefined {
  const v = cache.get(id);
  if (v) { cache.delete(id); cache.set(id, v); } // 触摸续期
  return v;
}

// ─── 工具入参 ──────────────────────────────────────────

const birthShape = {
  year: z.number().int().min(1900).max(2100).describe('公历出生年'),
  month: z.number().int().min(1).max(12).describe('公历出生月'),
  day: z.number().int().min(1).max(31).describe('公历出生日'),
  hour: z.number().int().min(0).max(23).describe('出生时（当地标准时 0-23，勿自行换算真太阳时——引擎会按经度校正）'),
  minute: z.number().int().min(0).max(59).default(0).describe('出生分'),
  gender: z.enum(['男', '女']).describe('性别'),
  sect: z.enum(['正统派', '传统派']).default('正统派').describe('晚子时口径：正统派=晚子时日柱算当天；传统派=算次日'),
  city: z.string().optional().describe('出生城市中文名（国内，如"北京""重庆"，用于真太阳时与地利）；与 longitude 二选一，都不给则不做真太阳时校正'),
  longitude: z.number().min(-180).max(180).optional().describe('出生地经度（国外或手动模式；东经正、西经负）'),
  latitude: z.number().min(-90).max(90).optional().describe('出生地纬度（北纬正、南纬负；地利寒热判断用）'),
  utcOffset: z.number().min(-12).max(14).optional().describe('出生地时区 UTC 偏移小时（如东京 9、纽约 -5）；缺省 8=北京时'),
};

const GENDER_MAP: Record<string, 0 | 1> = { 男: 1, 女: 0 };
const SECT_MAP: Record<string, 1 | 2> = { 正统派: 1, 传统派: 2 };

function toBaziInput(a: any): { input: BaziInput; warn?: string } {
  let warn: string | undefined;
  let latitude = a.latitude as number | undefined;
  if (a.city) {
    const c = getCityByName(a.city);
    if (!c) warn = `城市「${a.city}」不在内置城市表中，本次未做真太阳时校正；可改用 longitude/latitude 手动指定。`;
    else if (latitude === undefined) latitude = findLatitude(c.province);
  }
  const input: BaziInput = {
    year: a.year, month: a.month, day: a.day, hour: a.hour, minute: a.minute ?? 0,
    gender: GENDER_MAP[a.gender], sect: SECT_MAP[a.sect ?? '正统派'],
    city: a.city, longitude: a.longitude, latitude, utcOffset: a.utcOffset,
    engine: a.engine,
  };
  return { input, warn };
}

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const errText = (t: string) => ({ content: [{ type: 'text' as const, text: t }], isError: true as const });

function needChart(chartId: string): CachedChart | string {
  const c = getCache(chartId);
  if (!c) return `错误：chartId「${chartId}」不存在（服务可能已重启，缓存仅存于进程内）。请先用 paipan 重新排盘获取新的 chartId。`;
  return c;
}

// ─── Server ────────────────────────────────────────────

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'bazi-paipan', version: '1.0.0' },
    {
      instructions: [
        '八字排盘 MCP：工具即数据源，按需查询，禁止凭记忆排盘或引用古籍。',
        '流程：① paipan 得盘面摘要与 chartId；② 凭 chartId 调 query_year（单年详情）/ query_liuyue / query_liuri / get_kline / query_wuyunliuqi 深挖；③ 已知四柱找出生时间用 fanpai；快查调候表用 query_tiaohou；排盘存疑用 compare_engines 双引擎对拍。',
        '纪律：四柱、大运、神煞、调候、司令均以工具返回为准；结论请附盘面论据并标注置信度；健康/财运分析不构成医疗/投资建议。',
      ].join('\n'),
    },
  );

  server.registerTool('paipan', {
    title: '八字排盘',
    description: '输入公历生辰排八字，返回紧凑盘面摘要（四柱/五行/调候用神/人元司令/十神组合预检/神煞及释义/大运一览/K线速览）和 chartId。chartId 供后续 query_* 工具深挖，同参重排返回同一 id。',
    inputSchema: {
      ...birthShape,
      engine: z.enum(['mystilight', 'tyme']).default('mystilight').describe('排盘引擎：mystilight=渊海子平（分析最全，默认）；tyme=tyme4ts 干支历标准'),
    },
  }, async (a: any) => {
    try {
      const { input, warn } = toBaziInput(a);
      const chart = await calculateChart(input, input.engine ?? 'mystilight');
      const data = buildExportJSON(input, chart as any);
      const kline = buildLifeKline(chart as any);
      const id = chartIdOf(input);
      putCache(id, { input, chart, data, kline });
      const md = formatPaipanSummary(id, data, chart, kline, { year: input.year, month: input.month, day: input.day, hour: input.hour, minute: input.minute });
      return text(warn ? `⚠ ${warn}\n\n${md}` : md);
    } catch (e) {
      return errText(`排盘失败：${e instanceof Error ? e.message : String(e)}`);
    }
  });

  server.registerTool('query_year', {
    title: '查单一年份详情',
    description: '按 chartId 查某公历年的流年详情：所处大运、流年干支与藏干十神、流年神煞、K线五维评分及逐项因素归因、全年流月表。问"某年运势如何"优先用此工具。',
    inputSchema: {
      chartId: z.string().describe('paipan 返回的 chartId'),
      year: z.number().int().min(1900).max(2200).describe('要查询的公历年份'),
    },
  }, async (a: any) => {
    const c = needChart(a.chartId);
    if (typeof c === 'string') return errText(c);
    return text(formatYearDetail(c.data, c.kline, a.year));
  });

  server.registerTool('query_liuyue', {
    title: '查流月',
    description: '按 chartId 查某公历年 12 个流月的干支与十神（五虎遁）。',
    inputSchema: {
      chartId: z.string(),
      year: z.number().int().min(1900).max(2200).describe('公历年份'),
    },
  }, async (a: any) => {
    const c = needChart(a.chartId);
    if (typeof c === 'string') return errText(c);
    const dayGan = c.data.pillars?.dayMasterGan || c.data.pillars?.day?.gan || '';
    let lnGan = '';
    for (const d of c.data.dayunArr ?? []) {
      const hit = d.liunianArr?.find((x: any) => x.year === a.year);
      if (hit) { lnGan = hit.ganZhi?.[0] ?? ''; break; }
    }
    if (!lnGan) return errText(`错误：${a.year} 年不在本盘流年范围内`);
    const months = getLiuYueForYear(lnGan, dayGan);
    return text(`## ${a.year} 年流月（日主${dayGan}）\n\n` + months.map((m) => `- ${m.monthName}（${m.monthIndex}）：${m.ganZhi}（${m.shiShen}）`).join('\n'));
  });

  server.registerTool('query_liuri', {
    title: '查流日',
    description: '按 chartId 查某年某个节气月内逐日干支与十神（按节气边界划月）。择日用。',
    inputSchema: {
      chartId: z.string(),
      year: z.number().int().min(1900).max(2200).describe('流年公历年份'),
      month: z.number().int().min(1).max(12).describe('传统月序：1=正月(寅) … 12=腊月(丑)'),
    },
  }, async (a: any) => {
    const c = needChart(a.chartId);
    if (typeof c === 'string') return errText(c);
    const dayGan = c.data.pillars?.dayMasterGan || c.data.pillars?.day?.gan || '';
    const days = getLiuRiForMonth(a.year, a.month, dayGan);
    if (!days.length) return errText('错误：该月流日不可得（超出历法范围？）');
    return text(`## ${a.year} 年第 ${a.month} 个月（节气月）流日\n\n` +
      days.map((d) => `- ${d.solarMonth}/${d.solarDay}（${d.lunarMonth}${d.lunarDay}）：${d.ganZhi}（${d.shiShen}）`).join('\n'));
  });

  server.registerTool('get_kline', {
    title: '人生K线全貌',
    description: '按 chartId 返回五维（总/事业/财/情/健）量化评分全貌：身强弱判定、大运均分表、峰谷 TOP5 及因素。series=true 附逐年总分序列。',
    inputSchema: {
      chartId: z.string(),
      series: z.boolean().default(false).describe('是否附逐年总分序列'),
    },
  }, async (a: any) => {
    const c = needChart(a.chartId);
    if (typeof c === 'string') return errText(c);
    if (!c.kline) return errText('错误：本盘 K 线数据不可得（流年数据不足）');
    return text(formatKlineOverview(c.kline, !!a.series));
  });

  server.registerTool('query_wuyunliuqi', {
    title: '查五运六气',
    description: '按 chartId 返回出生年五运六气（中运/司天在泉/主客运/主客气/运气同化，及出生所值运步气步），用于先天体质禀赋分析。',
    inputSchema: { chartId: z.string() },
  }, async (a: any) => {
    const c = needChart(a.chartId);
    if (typeof c === 'string') return errText(c);
    const w = getWuYunLiuQi({ year: c.input.year, month: c.input.month, day: c.input.day, hour: c.input.hour, minute: c.input.minute });
    if (!w) return errText('错误：五运六气数据不可得');
    return text(buildWuYunLiuQiMarkdown(w));
  });

  server.registerTool('query_tiaohou', {
    title: '查调候用神表',
    description: '穷通宝鉴调候用神快查：任意日主天干 × 月支 → 用神序列（主用在前）。无需先排盘。',
    inputSchema: {
      dayGan: z.string().describe('日主天干（甲乙丙丁戊己庚辛壬癸之一）'),
      monthZhi: z.string().describe('月支（子丑寅卯辰巳午未申酉戌亥之一）'),
    },
  }, async (a: any) => {
    if (!TIAN_GAN.includes(a.dayGan)) return errText(`错误：日主「${a.dayGan}」须为十天干之一`);
    if (!DI_ZHI.includes(a.monthZhi)) return errText(`错误：月支「${a.monthZhi}」须为十二地支之一`);
    const gods = getTiaoHouGods(a.dayGan, a.monthZhi);
    if (!gods) return errText('错误：查表失败');
    return text(`${a.dayGan}日主生${a.monthZhi}月 → 调候用神：**${gods.join('、')}**（主用在前）\n\n> 源：穷通宝鉴·通行调候简表（佐神次序各本或有异文）。原局是否得此用神，请结合具体命盘透藏判断（paipan 结果含本造判定）。`);
  });

  server.registerTool('fanpai', {
    title: '八字反查出生时间',
    description: '已知四柱干支反查公历出生时间（近 60 年内的全部候选）。',
    inputSchema: {
      yearGZ: z.string().describe('年柱干支，如"庚午"'),
      monthGZ: z.string().describe('月柱干支'),
      dayGZ: z.string().describe('日柱干支'),
      timeGZ: z.string().describe('时柱干支'),
    },
  }, async (a: any) => {
    for (const [k, v] of Object.entries({ 年柱: a.yearGZ, 月柱: a.monthGZ, 日柱: a.dayGZ, 时柱: a.timeGZ })) {
      if (!JIA_ZI_60.includes(v as string)) return errText(`错误：${k}「${v}」不是有效六十甲子干支`);
    }
    const list = reverseLookupBazi(a.yearGZ, a.monthGZ, a.dayGZ, a.timeGZ);
    if (!list.length) return text('近 60 年内无匹配的公历时间（干支组合可能不成立或超出范围）。');
    return text(`## 反查候选（${a.yearGZ} ${a.monthGZ} ${a.dayGZ} ${a.timeGZ}）\n\n` +
      list.map((r) => `- 公历 ${r.solar}（农历 ${r.lunar}）`).join('\n') +
      '\n\n> 选定候选后可用 paipan 排完整命盘。');
  });

  server.registerTool('compare_engines', {
    title: '双引擎对拍校验',
    description: '同一命例用 mystilight（渊海子平）与 tyme4ts（干支历标准）并行排盘并对比：四柱/大运一致性硬校验 + 起运/宫位流派性差异。对排盘结果存疑时用。',
    inputSchema: { ...birthShape },
  }, async (a: any) => {
    try {
      const { input, warn } = toBaziInput(a);
      const r = await compareEngines(input);
      const L: string[] = [`## 双引擎对拍：${r.summary}`];
      if (r.items.length) {
        L.push('', '| 差异项 | 类型 | ' + r.a.name + ' | ' + r.b.name + ' |', '|---|---|---|---|');
        r.items.forEach((d) => L.push(`| ${d.label} | ${d.kind === 'hard' ? '核心差异' : '流派性差异'} | ${d.a} | ${d.b} |`));
        L.push('', '> 流派性差异（起运进位/宫位起法口径）属预期；核心差异需谨慎对待。');
      }
      return text((warn ? `⚠ ${warn}\n\n` : '') + L.join('\n'));
    } catch (e) {
      return errText(`对拍失败：${e instanceof Error ? e.message : String(e)}`);
    }
  });

  return server;
}

export async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[bazi-mcp] server ready (stdio)');
}
