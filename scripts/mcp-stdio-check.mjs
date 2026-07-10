// MCP stdio 纯净性 e2e：spawn 构建产物，走真实 stdio 协议，断言 stdout 每一行都是合法 JSON-RPC。
//
// 动机：vitest 的 MCP 测试走 InMemoryTransport，测不到 stdio 层——若有人在顶层加一句
// console.log，InMemory 全绿但 Claude Desktop 里协议直接撕裂。本脚本在 CI 中兜住这一风险。
// 用法：npm run mcp:build && node scripts/mcp-stdio-check.mjs
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist-mcp/server.mjs');
const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'pipe'] });

let badLines = 0;
const pending = new Map();
readline.createInterface({ input: child.stdout }).on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    badLines++;
    console.error('!! stdout 非 JSON 行（协议污染）:', line.slice(0, 160));
    return;
  }
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

let nextId = 1;
function call(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${method}`)), 30000);
    pending.set(id, (m) => { clearTimeout(t); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

try {
  const init = await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'stdio-check', version: '0' },
  });
  if (!init.result?.serverInfo?.name) throw new Error('initialize 无 serverInfo');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const tl = await call('tools/list', {});
  const toolCount = (tl.result?.tools ?? []).length;
  if (toolCount < 10) throw new Error(`tools/list 仅 ${toolCount} 个工具`);

  const pl = await call('prompts/list', {});
  const promptCount = (pl.result?.prompts ?? []).length;
  if (promptCount < 6) throw new Error(`prompts/list 仅 ${promptCount} 个 prompt`);

  // 免排盘的轻量调用，触发一次真实工具执行路径
  const qt = await call('tools/call', { name: 'query_tiaohou', arguments: { dayGan: '甲', monthZhi: '子' } });
  const qtText = (qt.result?.content ?? []).map((c) => c.text).join('');
  if (!qtText.includes('丁')) throw new Error('query_tiaohou 返回异常');

  // 触发一次排盘（引擎的耗时 console.log 必须已改道 stderr）
  const pp = await call('tools/call', {
    name: 'paipan',
    arguments: { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: '男', city: '北京' },
  });
  const ppText = (pp.result?.content ?? []).map((c) => c.text).join('');
  if (!ppText.includes('庚午')) throw new Error('paipan 返回异常');

  if (badLines > 0) throw new Error(`stdout 出现 ${badLines} 行非 JSON 输出（协议污染）`);
  console.error(`[mcp-stdio-check] PASS：tools=${toolCount} prompts=${promptCount}，stdout 纯净`);
  process.exit(0);
} catch (e) {
  console.error('[mcp-stdio-check] FAIL：', e.message ?? e);
  process.exit(1);
} finally {
  child.kill();
}
