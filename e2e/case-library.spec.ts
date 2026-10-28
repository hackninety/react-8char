import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';

async function exportToon(page: Page) {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出 TOON 文件' }).click();
  return fs.readFileSync((await (await download).path())!, 'utf8');
}

test('命例按需加载，显式选择后独立导出，清除/换盘移除引用', async ({ page }) => {
  const errors: string[] = [];
  const corpusRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('request', (request) => { if (request.url().includes('mingli-cases')) corpusRequests.push(request.url()); });
  await page.goto('/');
  await page.locator('#year').fill('1990');
  await page.locator('#month').fill('6');
  await page.locator('#day').fill('15');
  await page.locator('#hour').fill('8');
  await page.locator('#minute').fill('30');
  await page.getByRole('button', { name: '一键排盘' }).click();
  await expect(page.getByRole('heading', { name: /命盘/ })).toBeVisible();
  expect(corpusRequests).toHaveLength(0);

  const entry = page.getByTestId('case-library-entry');
  const library = page.getByRole('region', { name: '八字命例库', exact: true });
  await expect(library).toHaveCount(0);
  await entry.getByRole('button', { name: '打开命例库', exact: true }).click();
  await expect(library.getByLabel('命例来源')).toBeVisible();
  expect(corpusRequests.length).toBeGreaterThan(0);
  const selectFirst = async () => {
    await library.getByLabel('命例年份', { exact: true }).selectOption('2026');
    await library.getByLabel('命例列表', { exact: true }).getByRole('button').first().click();
    await expect(library.getByRole('button', { name: '揭晓答案', exact: true })).toBeVisible();
  };
  const referenceWithout = library.getByRole('button', { name: '用于 AI 参考（不含答案）', exact: true });
  const referenceWith = library.getByRole('button', { name: '用于 AI 参考（含已揭晓答案）', exact: true });
  await selectFirst();
  await expect(library.locator('.ml-answer')).toHaveCount(0);
  await expect(referenceWith).toBeDisabled();
  await library.getByRole('button', { name: '复制练习提示词', exact: true }).click();
  await expect(library.getByRole('status')).toContainText('不含答案和已知生平');
  const practice = await page.evaluate(() => (navigator as unknown as { clipboard: { readText: () => Promise<string> } }).clipboard.readText());
  expect(practice).not.toContain('参考答案：');
  await library.getByRole('button', { name: '揭晓答案', exact: true }).click();
  await expect(library.locator('.ml-answer').first()).toBeVisible();
  // 已揭晓时仍可选不含答案的参考；含答案参考必须另点明示按钮。
  await referenceWithout.click();
  await expect(entry.getByTestId('selected-case-reference')).toBeVisible();
  const withoutAnswers = await exportToon(page);
  expect(withoutAnswers).toContain('caseReference:');
  expect(withoutAnswers).not.toContain('显式揭晓的原资料答案');
  await referenceWith.click();
  await expect(entry.getByTestId('selected-case-reference')).toBeVisible();
  await expect(page.locator('#year')).toHaveValue('1990');
  const selected = await exportToon(page);
  expect(selected).toContain('caseReference:');
  expect(selected).toContain('显式揭晓的原资料答案');
  expect(selected).toContain('禁止将案例经历、吉凶或答案移植到当前命主');
  expect(selected).toContain('sourceRevision:');
  expect(selected).toContain('辛亥');

  await entry.getByTestId('selected-case-reference').getByRole('button', { name: '清除参考' }).click();
  await expect(entry.getByTestId('selected-case-reference')).toHaveCount(0);
  expect(await exportToon(page)).not.toContain('caseReference:');
  await entry.getByRole('button', { name: '打开命例库', exact: true }).click();
  await selectFirst();
  await expect(referenceWith).toBeDisabled();
  await referenceWithout.click();
  await expect(entry.getByTestId('selected-case-reference')).toBeVisible();
  expect(await exportToon(page)).not.toContain('显式揭晓的原资料答案');
  await page.locator('#year').fill('1991');
  await page.getByRole('button', { name: '一键排盘' }).click();
  await expect(page.getByRole('heading', { name: /命盘/ })).toBeVisible();
  await expect(entry.getByTestId('selected-case-reference')).toHaveCount(0);
  await expect(library).toHaveCount(0);
  expect(await exportToon(page)).not.toContain('caseReference:');
  expect(errors).toHaveLength(0);
});
