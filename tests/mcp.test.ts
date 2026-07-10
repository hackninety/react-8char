// MCP server 回归测试：SDK InMemoryTransport 免 spawn 全链路（工具清单/排盘/追查/错误路径）。
// stdio 层面的纯净性（console.log 改道 stderr）由入口 mcp/server.ts 保证，
// 端到端探针见开发记录；此处测协议与工具行为本身。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../mcp/tools';

let client: Client;
let close: () => Promise<void>;

const textOf = (r: any): string => (r.content ?? []).map((c: any) => c.text).join('\n');

beforeAll(async () => {
  const [ct, st] = InMemoryTransport.createLinkedPair();
  const server = createServer();
  client = new Client({ name: 'vitest', version: '0.0.0' });
  await Promise.all([server.connect(st), client.connect(ct)]);
  close = async () => { await client.close(); };
});

afterAll(async () => { await close(); });

describe('MCP server', () => {
  it('工具清单：9 个工具', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'compare_engines', 'fanpai', 'get_kline', 'paipan',
      'query_liuri', 'query_liuyue', 'query_tiaohou', 'query_wuyunliuqi', 'query_year',
    ]);
  });

  let chartId = '';

  it('paipan：返回盘面摘要与 chartId（回显原始输入而非校正后时刻）', async () => {
    const r: any = await client.callTool({
      name: 'paipan',
      arguments: { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: '男', city: '北京' },
    });
    const t = textOf(r);
    chartId = (t.match(/bz-[a-z0-9]+/) ?? [''])[0];
    expect(chartId).toMatch(/^bz-/);
    expect(t).toContain('庚午');
    expect(t).toContain('8:30'); // 原始输入回显（校正后为 8:15，只出现在真太阳时说明行）
    expect(t).toContain('调候用神');
    expect(t).toContain('人元司令');
    expect(t).toContain('十神组合线索');
    expect(t).toContain('大运一览');
  });

  it('query_year：单年详情含 K线归因与流月', async () => {
    const r: any = await client.callTool({ name: 'query_year', arguments: { chartId, year: 2026 } });
    const t = textOf(r);
    expect(t).toContain('丙午');
    expect(t).toContain('K线评分');
    expect(t).toContain('流月');
  });

  it('query_tiaohou：免排盘快查，附《穷通宝鉴》原文段', async () => {
    const r: any = await client.callTool({ name: 'query_tiaohou', arguments: { dayGan: '甲', monthZhi: '子' } });
    const t = textOf(r);
    expect(t).toContain('丁');
    expect(t).toContain('原文');
    expect(t).toContain('十一月甲木');
  });

  it('fanpai 自洽：北京盘四柱反查命中原出生日期', async () => {
    const r: any = await client.callTool({
      name: 'fanpai',
      arguments: { yearGZ: '庚午', monthGZ: '壬午', dayGZ: '辛亥', timeGZ: '壬辰' },
    });
    expect(textOf(r)).toContain('1990-06-15');
  });

  it('错误路径：无效 chartId 返回 isError 与重排指引', async () => {
    const r: any = await client.callTool({ name: 'query_year', arguments: { chartId: 'bz-nope', year: 2026 } });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('paipan');
  });

  it('错误路径：非法干支反查被拒', async () => {
    const r: any = await client.callTool({
      name: 'fanpai',
      arguments: { yearGZ: '甲丑', monthGZ: '壬午', dayGZ: '辛亥', timeGZ: '壬辰' },
    });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('甲丑');
  });
});
