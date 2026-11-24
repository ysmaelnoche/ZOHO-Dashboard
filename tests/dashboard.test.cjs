const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { createPreviewServer } = require('../server');

test('Dashboard renders synthetic data, supports review and refresh, and fits a narrow widget', async (t) => {
  const server = createPreviewServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const browser = await chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : { channel: 'msedge' }
  );
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } });
  const external = [];
  const base = 'http://127.0.0.1:' + server.address().port;
  await page.route('**/*', (route) => {
    if (route.request().url().startsWith(base + '/')) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(base + '/app/widget.html');
  await page.getByText('Synthetic data · Local preview only', { exact: true }).waitFor({ timeout: 5000 });
  assert.equal(await page.getByRole('heading', { name: 'Daily Operations', exact: true }).count(), 1);
  assert.equal(await page.locator('#metrics dt').count(), 4);
  assert.equal(await page.locator('tbody tr').count(), 4);
  await page.getByRole('button', { name: 'Review PH-DEMO-101' }).click();
  assert.match(await page.getByRole('dialog').innerText(), /Confirm contact attempt/i);
  await page.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.getByText('Synthetic data loaded.').waitFor({ timeout: 5000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  assert.deepEqual(external, []);
  assert.equal(await page.locator('#updated time').count(), 1);
});
