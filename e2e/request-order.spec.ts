import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 仅在浏览器测试替换引擎门面，真实算法照常运行；用可释放的闸门确定请求完成顺序。
async function setup(page: Page, restore = false) {
  await page.addInitScript(({ restore }) => {
    const a = { year: 1990, month: 6, day: 15, hour: 8, minute: 30, gender: 1, sect: 2, name: '甲', compare: true };
    const b = { year: 1985, month: 1, day: 20, hour: 23, minute: 30, gender: 0, sect: 2, name: '乙', compare: true };
    localStorage.setItem('react-8char:profiles:v1', JSON.stringify([a, b].map(input => ({ id: input.name, name: input.name, input, savedAt: '2026-01-01T00:00:00Z' }))));
    if (restore) localStorage.setItem('react-8char:params:v1', JSON.stringify(a));
    (window as any).__requests = [];
  }, { restore });
  await page.route('**/src/lib/engine/index.ts', async route => {
    await route.fulfill({ contentType: 'application/javascript', body: `
      import * as real from '/src/lib/engine/index.ts?request-order-original';
      export * from '/src/lib/engine/index.ts?request-order-original';
      const wait = (kind, input) => new Promise((resolve, reject) => {
        window.__requests.push({ kind, name: input.name, settled: false, release: resolve, fail: () => reject(new Error('旧请求失败')) });
      });
      export async function calculateChart(input, engine) {
        await wait('chart', input);
        const result = await real.calculateChart(input, engine);
        window.__requests.find(r => r.kind === 'chart' && r.name === input.name).settled = true;
        return result;
      }
      export async function compareEngines(input) {
        await wait('compare', input);
        const report = await real.compareEngines(input);
        window.__requests.find(r => r.kind === 'compare' && r.name === input.name).settled = true;
        return { ...report, summary: input.name + '的对拍结果' };
      }
    ` });
  });
  await page.goto('/');
}

async function waitForRequest(page: Page, kind: string, name: string) {
  await expect.poll(() => page.evaluate(({ kind, name }) => (window as any).__requests.some((r: any) => r.kind === kind && r.name === name), { kind, name })).toBe(true);
}
async function release(page: Page, kind: string, name: string, fail = false) {
  await waitForRequest(page, kind, name);
  await page.evaluate(({ kind, name, fail }) => {
    const request = (window as any).__requests.find((r: any) => r.kind === kind && r.name === name);
    request[fail ? 'fail' : 'release']();
  }, { kind, name, fail });
  if (!fail) await expect.poll(() => page.evaluate(({ kind, name }) => (window as any).__requests.find((r: any) => r.kind === kind && r.name === name)?.settled, { kind, name })).toBe(true);
  // 让 React 完成本次异步回调的状态提交。
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function assertLatestChartAndExports(page: Page) {
  await expect(page.getByRole('heading', { name: '坤造命盘' })).toBeVisible();
  await expect(page.getByText('1985年1月20日 23时30分', { exact: false })).toBeVisible();
  await expect(page.getByText('甲的对拍结果')).toHaveCount(0);
  await expect(page.getByText('旧请求失败', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('react-8char:params:v1')!))).toMatchObject({ name: '乙', year: 1985 });
  for (const label of ['导出 TOON 文件', '导出 Markdown 文件']) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: new RegExp(label) }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('乙');
    const content = readFileSync((await download.path())!, 'utf8');
    expect(content).toContain('乙');
    expect(content).toContain('1985');
    expect(content).not.toContain('1990年6月15日');
  }
  for (const label of ['复制 AI Prompt（TOON）', '复制 AI 分析（Markdown）']) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const content = await page.evaluate(() => navigator.clipboard.readText());
    expect(content).toContain('乙');
    expect(content).toContain('1985');
    expect(content).not.toContain('1990年6月15日');
  }
}

test('旧成功迟到不能覆盖新档案，页面、姓名、全部导出仍是新盘', async ({ page }) => {
  await setup(page);
  await page.getByTestId('profile-load-甲').click(); await waitForRequest(page, 'chart', '甲');
  await page.getByTestId('profile-load-乙').click(); await release(page, 'chart', '乙');
  await release(page, 'chart', '甲');
  await assertLatestChartAndExports(page);
});

test('旧失败迟到不能清除新请求 loading 或显示旧错误', async ({ page }) => {
  await setup(page);
  await page.getByTestId('profile-load-甲').click(); await waitForRequest(page, 'chart', '甲');
  await page.getByTestId('profile-load-乙').click(); await waitForRequest(page, 'chart', '乙');
  await release(page, 'chart', '甲', true);
  await expect(page.getByText('正在排盘，请稍候...')).toBeVisible();
  await expect(page.getByText('旧请求失败', { exact: false })).toHaveCount(0);
  await release(page, 'chart', '乙');
  await assertLatestChartAndExports(page);
});

test('旧对拍迟到不能挂到新命盘，最新对拍仍可正常补挂', async ({ page }) => {
  await setup(page);
  await page.getByTestId('profile-load-甲').click(); await release(page, 'chart', '甲');
  await waitForRequest(page, 'compare', '甲');
  await page.getByTestId('profile-load-乙').click(); await release(page, 'chart', '乙');
  await release(page, 'compare', '甲');
  await assertLatestChartAndExports(page);
  await release(page, 'compare', '乙');
  await expect(page.getByRole('button', { name: '乙的对拍结果', exact: true })).toBeVisible();
});

test('刷新自动恢复的旧请求不能覆盖随后载入的档案', async ({ page }) => {
  await setup(page, true); await waitForRequest(page, 'chart', '甲');
  await page.getByTestId('profile-load-乙').click(); await release(page, 'chart', '乙');
  await release(page, 'chart', '甲');
  await assertLatestChartAndExports(page);
});
