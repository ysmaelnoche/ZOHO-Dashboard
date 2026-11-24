const assert = require('node:assert/strict');
const { mkdir, readFile } = require('node:fs/promises');
const { resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const { createPreview } = require('./preview.cjs');

const concepts = Array.from({ length: 6 }, (_, index) => 'concept-0' + (index + 1));
const screenshotDir = resolve(__dirname, 'screenshots');
const widths = [1440, 720, 390];
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);

async function loadDataset() {
  const script = await readFile(resolve(__dirname, 'data.js'), 'utf8');
  return runInNewContext(script + '\ndemo;');
}

function verifyCohorts(dataset) {
  let cases = 0;
  for (const period of dataset.periods) {
    for (const source of ['', ...dataset.sources]) {
      for (const product of ['', ...dataset.products]) {
        for (const territory of ['', ...dataset.territories]) {
          const report = dataset.snapshot(period, source, product, territory);
          const stages = ['cohort', 'eligible', 'assigned', 'contacted', 'verified'];
          stages.slice(1).forEach((stage, i) => {
            assert.ok(report[stage].every(row => report[stages[i]].includes(row)), stage);
          });
          assert.equal(report.eligible.length, report.assigned.length + report.waiting.length);
          assert.equal(report.eligible.length, sum(report.trend, 'intake'));
          assert.equal(report.contacted.length, sum(report.trend, 'contacts'));
          assert.equal(report.verified.length, sum(report.trend, 'verified'));
          assert.equal(report.pending.length + report.verified.length, sum(report.trend, 'reported'));
          assert.equal(report.pending.length, report.queue.filter(row => ['sale', 'evidence'].includes(row.kind)).length);
          assert.equal(report.queue.length, new Set(report.queue.map(row => row.id)).size);
          for (const group of ['sources', 'products', 'dealers']) {
            assert.equal(report.cohort.length, sum(report[group], 'received'));
            assert.equal(report.eligible.length, sum(report[group], 'eligible'));
            assert.equal(report.verified.length, sum(report[group], 'verified'));
          }
          cases++;
        }
      }
    }
  }
  return cases;
}

async function assertWidth(page, width) {
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  assert.ok(documentWidth <= width, 'Body at ' + width + 'px overflowed to ' + documentWidth + 'px');
}

async function verifyConcept(page, base, concept, dataset) {
  const url = base + '/' + concept + '.html';
  await page.setViewportSize({ width: widths[0], height: 1000 });
  await page.goto(url);
  await page.locator('#metrics .metric').first().waitFor();
  await page.getByText('DEMO DATA', { exact: true }).waitFor();
  assert.equal(await page.locator('.metric').count(), 4);
  if (process.argv.includes('--capture')) {
    await page.screenshot({ path: resolve(screenshotDir, concept + '.png') });
  }
  await assertWidth(page, widths[0]);

  const defaultIssue = await page.locator('#issue').inputValue();
  assert.equal(defaultIssue, concept === 'concept-05' ? 'sales' : '');
  const queue = page.locator('#queue');
  const review = queue.getByRole('button', { name: /^Review PH-DEMO-/ }).first();
  await review.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByRole('heading', { name: 'Next action' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await review.evaluate(node => node === document.activeElement), true);

  if (concept === 'concept-02' || concept === 'concept-06') {
    await page.locator('#task-sort').selectOption('due');
    assert.equal(await page.locator('#task-sort').inputValue(), 'due');
  } else {
    await queue.getByRole('button', { name: 'Deadline' }).click();
    assert.equal(await queue.locator('[aria-sort="ascending"] button').innerText(), 'Deadline ↑');
    await queue.getByRole('button', { name: 'Deadline' }).click();
    assert.equal(await queue.locator('[aria-sort="descending"] button').innerText(), 'Deadline ↓');
  }
  const latest = dataset.snapshot(dataset.periods[0], '', '');
  if (concept === 'concept-02') {
    const intake = queue.getByRole('region', { name: 'Intake & assignment' });
    const dealer = queue.getByRole('region', { name: 'Dealer contact' });
    const intakeBefore = await intake.locator('ul').innerText();
    const dealerBefore = await dealer.locator('ul').innerText();
    await intake.getByRole('button', { name: 'Next handoffs', exact: false }).click();
    assert.notEqual(await intake.locator('ul').innerText(), intakeBefore);
    assert.equal(await dealer.locator('ul').innerText(), dealerBefore);
    await intake.getByRole('button', { name: 'Previous handoffs', exact: false }).click();
    assert.equal(await intake.locator('ul').innerText(), intakeBefore);
    const critical = queue.getByRole('button', { name: 'Critical only' });
    await critical.click();
    assert.equal(await critical.getAttribute('aria-pressed'), 'true');
    assert.equal(await queue.locator('.lane-card-top .priority:not(.critical)').count(), 0);
    assert.ok((await queue.locator('.queue-tools').innerText()).includes(latest.queue.filter(row => row.critical).length + ' matching issues'));
    await critical.click();
  } else {
    await queue.getByRole('button', { name: 'Next' }).click();
    assert.equal(await queue.getByRole('button', { name: 'Previous' }).isEnabled(), true);
    await queue.getByRole('button', { name: 'Previous' }).click();
  }
  await page.locator('#issue').selectOption('quality');
  const quality = latest.queue.filter(row => row.kind === 'quality').length;
  assert.ok((await queue.locator('.queue-tools').innerText()).includes(quality + ' matching issues'));

  await page.getByRole('button', { name: 'Executive Overview' }).click();
  const conversion = page.locator('[data-metric="conversion"]');
  await conversion.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByText(/Verified sales divided by eligible leads/).waitFor();
  assert.equal(await dialog.locator('tbody tr').count(), latest.eligible.length);
  await dialog.getByRole('button', { name: 'Close' }).click();

  const [source] = dataset.sources;
  const product = dataset.products[1];
  await page.locator('#period').selectOption('1');
  await page.locator('#source').selectOption(source);
  await page.locator('#product').selectOption(product);
  const territory = concept === 'concept-04' ? dataset.territories[0] : '';
  if (territory) {
    await page.locator('[data-facet="territory"][data-label="' + territory + '"]').click();
    assert.equal(await page.locator('#territory').inputValue(), territory);
  }
  const filtered = dataset.snapshot(dataset.periods[1], source, product, territory);
  assert.equal(await conversion.locator('strong').innerText(),
    filtered.eligible.length ? Math.round(filtered.verified.length / filtered.eligible.length * 100) + '%' : '—');
  assert.ok((await page.locator('#report-status').textContent()).includes(filtered.cohort.length + ' submissions'));
  if (concept === 'concept-05') {
    await page.locator('[data-age="2"]').click();
    const age = filtered.pending.filter(row => dataset.periods[1].end - row.reported >= 2).length;
    await dialog.getByText(age + ' matching records', { exact: true }).waitFor();
    await page.keyboard.press('Escape');
  }
  const emptyIssue = Object.keys({ contact: 1, assignment: 1, follow: 1, evidence: 1, sale: 1, quality: 1 })
    .find(kind => !filtered.queue.some(row => row.kind === kind));
  if (emptyIssue) {
    await page.locator('#issue').selectOption(emptyIssue);
    await queue.getByText('No exceptions match these filters.', { exact: false }).waitFor();
  }
  await page.getByRole('button', { name: 'Reset' }).click();
  assert.equal(await page.locator('#source').inputValue(), '');
  assert.equal(await page.locator('#period').inputValue(), '0');
  for (const width of widths.slice(1)) {
    await page.setViewportSize({ width, height: 820 });
    await assertWidth(page, width);
    await page.getByRole('button', { name: 'Daily Operations' }).click();
    await assertWidth(page, width);
    await page.getByRole('button', { name: 'Executive Overview' }).click();
  }
  console.log(concept + ' passed at ' + widths.join(', ') + 'px');
}

async function verifyGallery(page, base) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base);
  assert.equal(await page.locator('article').count(), 6);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  assert.equal((await page.request.get(base + '/DESIGN_COMPARISON.md')).status(), 200);
  await page.locator('#right-choice').selectOption('concept-01.html');
  await page.getByRole('button', { name: 'Load comparison' }).click();
  await page.getByText('Choose two different concepts.').waitFor();
  await page.locator('#right-choice').selectOption('concept-04.html');
  await page.getByRole('button', { name: 'Load comparison' }).click();
  for (const concept of ['concept-01', 'concept-04']) {
    const frame = page.frameLocator('iframe[src$="/' + concept + '.html"]');
    await frame.locator('#metrics .metric').first().waitFor();
  }
  await page.setViewportSize({ width: 390, height: 820 });
  await assertWidth(page, 390);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.goto(base);
  if (process.argv.includes('--capture')) {
    await page.screenshot({ path: resolve(screenshotDir, 'gallery.png'), fullPage: true });
  }
  console.log('Gallery thumbnails, paired previews and narrow layout passed');
}

async function main() {
  const dataset = await loadDataset();
  console.log(verifyCohorts(dataset) + ' cohort/filter combinations reconcile');
  const server = createPreview();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const options = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : { channel: 'msedge' };
    browser = await chromium.launch(options);
    const page = await browser.newPage();
    page.setDefaultTimeout(6000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(response.status() + ' ' + response.url()); });
    await page.route('**/*', route => {
      if (route.request().url().startsWith(base + '/')) return route.continue();
      errors.push('Unexpected request: ' + route.request().url());
      return route.abort();
    });
    if (process.argv.includes('--capture')) await mkdir(screenshotDir, { recursive: true });
    for (const concept of concepts) await verifyConcept(page, base, concept, dataset);
    await verifyGallery(page, base);
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    if (process.argv.includes('--verify-error')) {
      await page.route('**/data.js', route => route.abort());
      await page.goto(base + '/concept-01.html');
      await page.getByText('The synthetic report could not load.', { exact: false }).waitFor();
      assert.equal(await page.locator('#period').isDisabled(), true);
      assert.ok(errors.splice(0).length > 0, 'Missing dataset should trigger the simulated error');
    }
    assert.deepEqual(errors, [], 'Unexpected browser errors');
    await page.unrouteAll();
    for (const concept of concepts) {
      await page.goto(pathToFileURL(resolve(__dirname, concept + '.html')).href);
      await page.locator('#metrics .metric').first().waitFor();
    }
    assert.deepEqual(errors, []);
    console.log('Direct HTML file preview passed');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
