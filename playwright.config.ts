// Playwright UI e2e：真实浏览器驱动核心用户流程（排盘/档案/合婚/流月下钻/导出下载）。
// 本地复用已开的 dev server，CI 自启；仅 chromium（够用且省 CI 时间）。
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 40_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    permissions: ['clipboard-read', 'clipboard-write'],
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
