// 独立 vitest 配置（不合并 vite.config.ts——测试是纯 node 逻辑，无需 react/tailwind 插件）。
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 引擎排盘单例 ~30ms，全量用例秒级；不设并发限制
  },
});
