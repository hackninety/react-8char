// MCP server 打包（原 package.json 内联 esbuild CLI，参数不变）：
// 改用 JS API 以挂 mystilight 节气尺度补丁，与 vite build / Vitest 同源。
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mystilightEsbuildPlugin } from './mystilight-jieqi-patch.mjs';

await build({
  absWorkingDir: path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
  entryPoints: ['mcp/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist-mcp/server.mjs',
  logLevel: 'warning',
  plugins: [mystilightEsbuildPlugin()],
});
