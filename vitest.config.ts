// 独立 vitest 配置（不合并 vite.config.ts——测试是纯 node 逻辑，无需 react/tailwind 插件）。
import { defineConfig } from 'vitest/config';
import { mystilightVitePlugin } from './scripts/mystilight-jieqi-patch.mjs';

export default defineConfig({
  // mystilight 节气尺度补丁与 vite build 同源；该包须 inline 才会经过插件 transform（默认外置直接由 Node 加载）
  plugins: [mystilightVitePlugin()],
  test: {
    environment: 'node',
    server: { deps: { inline: [/mystilight-8char/] } },
    include: ['tests/**/*.test.ts'],
    // 引擎排盘单例 ~30ms，全量用例秒级；不设并发限制
  },
});
