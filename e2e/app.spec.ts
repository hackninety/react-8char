// UI e2e：真实浏览器走核心用户流程。
// 断言尽量落在确定性事实上（golden 命例的干支、下载文件内容），而非样式细节。
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

/** 填公历生辰（默认城市北京），点一键排盘并等待命盘出现 */
async function paipan(page: Page, y: string, m: string, d: string, h: string, min: string) {
  await page.locator('#year').fill(y);
  await page.locator('#month').fill(m);
  await page.locator('#day').fill(d);
  await page.locator('#hour').fill(h);
  await page.locator('#minute').fill(min);
  await page.getByRole('button', { name: '一键排盘' }).click();
  await expect(page.getByRole('heading', { name: /命盘/ })).toBeVisible({ timeout: 15_000 });
}

test('排盘 → K线流月下钻 → TOON 下载（golden 命例干支断言，零页面错误）', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') pageErrors.push(msg.text());
  });

  await page.goto('/');
  await paipan(page, '1990', '6', '15', '8', '30');

  // golden：北京男 1990-06-15 08:30 → 庚午 壬午 辛亥 壬辰（页面呈现年柱与日主）
  await expect(page.getByText('庚', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('· 日主')).toBeVisible();

  // 格局面板：取格结论 + 子平真诠原文（懒加载 chunk）+ 当前运限格局行
  const geju = page.getByTestId('geju-panel');
  await expect(geju).toBeVisible();
  await expect(geju.getByText('七杀格').first()).toBeVisible();
  await expect(geju.getByText(/《子平真诠·论偏官》原文/)).toBeVisible({ timeout: 10_000 });
  await geju.getByText(/《子平真诠·论偏官》原文/).click(); // 展开 details
  await expect(geju.getByText(/公有领域/)).toBeVisible();
  await expect(geju.getByTestId('yun-patterns')).toBeVisible();

  // 十年规划表：行展开逐年明细（丙戌运 2027 起）
  const dplan = page.getByTestId('decade-plan');
  await expect(dplan).toBeVisible();
  await dplan.getByTestId('dp-row-丙戌').click();
  await expect(dplan.getByText('2027', { exact: false }).first()).toBeVisible();

  // 人生K线渲染 + 点击年蜡烛下钻流月
  const kline = page.locator('svg').filter({ has: page.locator('rect') }).first();
  await expect(kline).toBeVisible();
  await page.locator('svg rect[fill="transparent"]').nth(30).click();
  await expect(page.getByTestId('month-kline')).toBeVisible();
  await expect(page.getByText('流月K线')).toBeVisible();

  // 能量多边形：宫位轴（golden 男命婚姻并入财帛轴）+ 三层图例随选中年出现
  const radar = page.getByTestId('wuxing-radar');
  await expect(radar).toBeVisible();
  await expect(radar.getByText('能量多边形').first()).toBeVisible();
  await expect(radar.getByText('财帛·婚姻').first()).toBeVisible();
  await expect(radar.getByText('事业官禄').first()).toBeVisible();
  await expect(radar.getByText(/\+大运/).first()).toBeVisible();
  await expect(radar.getByText(/\+流年/).first()).toBeVisible();

  // 大限视图：一运一蜡烛 + 大限详情（十神/长生/运限格局）+ 雷达自动收窄到大限档（无流年层）
  await page.getByTestId('kline-view').getByRole('button', { name: '大限' }).click();
  await expect(page.getByTestId('decade-kline')).toBeVisible();
  await expect(page.getByTestId('decade-detail')).toBeVisible();
  await expect(page.getByTestId('decade-detail').getByText(/大运/).first()).toBeVisible();
  await expect(page.getByTestId('decade-detail').getByText('运限格局:')).toBeVisible();
  await expect(radar.getByText(/\+大运/).first()).toBeVisible();
  await expect(radar.getByText(/\+流年/)).toHaveCount(0);

  // 总局档：仅原局层（总命局能量）
  await page.getByTestId('radar-scope').getByRole('button', { name: '总局' }).click();
  await expect(radar.getByText('总命局(原局八字)')).toBeVisible();
  await expect(radar.getByText(/\+大运/)).toHaveCount(0);

  // 回到流年视图与流年档，后续流程不受影响
  await page.getByTestId('radar-scope').getByRole('button', { name: '大限' }).click();
  await page.getByTestId('kline-view').getByRole('button', { name: '流年' }).click();
  await page.getByTestId('radar-scope').getByRole('button', { name: '流年' }).click();
  await expect(radar.getByText(/\+流年/).first()).toBeVisible();

  // 导出 TOON 下载：文件名与内容
  const dlPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 TOON 文件' }).click();
  const dl = await dlPromise;
  expect(dl.suggestedFilename()).toMatch(/\.toon$/);
  const content = fs.readFileSync((await dl.path())!, 'utf8');
  expect(content).toContain('meta:');
  expect(content).toContain('庚午');
  expect(content).toContain('tiaoHou');
  expect(content).toContain('decadePlan');
  // 能量多边形不随导出（与 wuXingPower 双套口径易被 AI 混用；雷达图仅页面展示）
  expect(content).not.toContain('wuxingEnergy');

  expect(pageErrors, `页面错误：\n${pageErrors.join('\n')}`).toHaveLength(0);
});

test('档案保存/载入 → 合婚对照 → 合婚 MD 下载', async ({ page }) => {
  await page.goto('/');

  // 第一人：北京男 golden
  await paipan(page, '1990', '6', '15', '8', '30');
  await page.getByTestId('profile-name').fill('张三');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-load-张三')).toBeVisible();

  // 第二人：改生辰再排、再存
  await paipan(page, '1985', '1', '20', '23', '30');
  await page.getByTestId('profile-name').fill('李四');
  await page.getByTestId('profile-save').click();
  await expect(page.getByTestId('profile-load-李四')).toBeVisible();

  // 合婚：原生 select 按序选甲乙 → 生成清单
  await page.getByTestId('hehun-a').selectOption({ index: 1 });
  await page.getByTestId('hehun-b').selectOption({ index: 2 });
  await page.getByTestId('hehun-run').click();
  const items = page.getByTestId('hehun-items').locator('li');
  await expect(items.first()).toBeVisible({ timeout: 15_000 });
  expect(await items.count()).toBeGreaterThanOrEqual(5);

  // 合婚 MD 下载
  const dlPromise = page.waitForEvent('download');
  await page.getByTestId('hehun-md').click();
  const dl = await dlPromise;
  expect(dl.suggestedFilename()).toMatch(/^合婚_.*\.md$/);
  const md = fs.readFileSync((await dl.path())!, 'utf8');
  expect(md).toContain('合婚对照');
  expect(md).toContain('不构成婚姻决策依据');

  // 档案载入：点击张三 chip → 命盘重算回北京盘
  await page.getByTestId('profile-load-张三').click();
  await expect(page.getByRole('heading', { name: /命盘/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('1990').first()).toBeVisible();
});
