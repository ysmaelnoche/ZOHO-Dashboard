const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { createPreviewServer } = require('../server');
const { createStagingArea } = require('../scripts/widgets.cjs');

async function start(t, options = {}, root) {
  const server = createPreviewServer(root);
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : { channel: 'msedge' });
  t.after(() => browser.close());
  return { page: await browser.newPage({ viewport: { width: 390, height: 840 }, ...options }), base: 'http://127.0.0.1:' + server.address().port };
}

test('Each standalone edition serves only its own dashboard and ignores the other view’s hash', async t => {
  const staging = createStagingArea();
  t.after(() => staging.dispose());
  const cases = [
    ['daily', '#executive', 'CRM handoff board', '#content', '#executive-content', 'executive'],
    ['executive', '#queue', 'Philippine sales & dealer performance', '#executive-content', '#content', 'dashboard'],
  ];
  for (const [edition, wrongHash, heading, visible, absent, other] of cases) {
    await t.test(edition, async subtest => {
      const { page, base } = await start(subtest, { viewport: { width: 320, height: 760 } }, staging.stage(edition));
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/app/widget.html' + wrongHash);
      await page.getByText('Synthetic data loaded.', { exact: true }).waitFor();
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await page.locator(visible).isVisible(), true);
      assert.equal(await page.locator(absent + ', #switch-view').count(), 0);
      assert.equal(await page.locator('.skeleton-view').count(), 1);
      assert.equal(await page.getByRole('dialog', { includeHidden: true }).count(), edition === 'daily' ? 1 : 0);
      assert.equal((await page.request.get(base + '/app/js/ui/' + other + '.js')).status(), 404);
      assert.equal((await page.request.get(base + '/app/js/data/' + other + '.js')).status(), 404);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
      assert.deepEqual(errors, []);
    });
  }
});

test('Local widget uses the Handoff Board, filters synthetic records and preserves each lane independently', async t => {
  const { page, base } = await start(t);
  const external = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith(base + '/')) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(base + '/app/widget.html');
  await page.getByText('Synthetic data loaded.', { exact: true }).waitFor();
  await page.getByText('DEMO DATA', { exact: true }).waitFor();
  assert.equal(await page.getByRole('progressbar', { name: 'Loading dashboard' }).isVisible(), false);
  assert.equal(await page.locator('#metrics .metric').count(), 4);
  assert.equal(await page.locator('.lanes > section').count(), 3);
  const sidebar = page.getByRole('complementary').filter({ has: page.getByRole('navigation', { name: 'Workspace sections' }) });
  assert.equal(await sidebar.getByText('Philippines CRM', { exact: true }).count(), 0);
  assert.equal(await sidebar.getByText('TVSPH', { exact: true }).count(), 0);
  assert.deepEqual(await sidebar.getByRole('navigation', { name: 'Workspace sections' }).getByRole('link').allTextContents(),
    ['Overview', 'Work queue', 'Issues to check', 'Dealer follow-up']);
  const currentLink = () => sidebar.locator('a[aria-current="location"]').innerText();
  assert.equal(await currentLink(), 'Overview');
  await sidebar.getByRole('link', { name: 'Work queue' }).click();
  await page.waitForFunction(() => document.querySelector('nav a[aria-current="location"]')?.hash === '#queue');
  assert.equal(await currentLink(), 'Work queue');
  const search = page.getByRole('searchbox', { name: 'Find a lead' });
  await search.pressSequentially('sÁmple   lead 107');
  assert.equal(await search.evaluate(node => node === document.activeElement), true);
  await page.getByText('1 matching lead', { exact: true }).waitFor();
  assert.deepEqual(await page.locator('.lanes [data-record]').evaluateAll(nodes => nodes.map(node => node.dataset.record)), ['PH-DEMO-107']);
  await search.fill('No such lead');
  await page.getByText('0 matching leads', { exact: true }).waitFor();
  await search.fill('');
  await page.setViewportSize({ width: 1440, height: 850 });
  const laneLayout = await page.locator('.lanes > section').evaluateAll(lanes => lanes.map(lane => {
    const bounds = element => {
      const { top, bottom } = element.getBoundingClientRect();
      return [Math.round(top), Math.round(bottom)];
    };
    return { lane: bounds(lane), cards: [...lane.querySelectorAll('ul > li')].map(bounds),
      review: [...lane.querySelectorAll('ul > li button')].map(bounds) };
  }));
  assert.ok(laneLayout[0].cards.length > 0);
  for (const lane of laneLayout.slice(1)) {
    assert.deepEqual(lane, laneLayout[0]);
  }
  await page.setViewportSize({ width: 390, height: 840 });
  assert.equal(await page.getByRole('combobox', { name: 'Product line' }).count(), 0);
  assert.match(await page.locator('[data-metric="newLeads"]').innerText(), /9 in this view/);
  await page.locator('#analysis').getByText('Recorded lead stages', { exact: true }).click();
  const stages = page.getByRole('region', { name: 'Recorded lead stages' });
  assert.equal(await stages.locator('tbody td').allTextContents().then(counts => counts.reduce((total, count) => total + Number(count), 0)), 9);
  const dealer = page.getByRole('region', { name: 'Dealer contact', exact: true });
  const intake = page.getByRole('region', { name: 'Lead review & assignment' });
  const intakeBefore = await intake.locator('ul').textContent();
  const first = await dealer.locator('ul').textContent();
  await dealer.getByRole('button', { name: 'Next leads for Dealer contact' }).click();
  assert.notEqual(await dealer.locator('ul').textContent(), first);
  assert.equal(await intake.locator('ul').textContent(), intakeBefore);
  await dealer.getByRole('button', { name: 'Previous leads for Dealer contact' }).click();

  const review = page.getByRole('button', { name: 'Review Sample Lead 101' });
  await review.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('dialog').getByText(/confirm first contact/i).waitFor();
  assert.equal(await page.getByRole('dialog').getByRole('heading', { name: 'Sample Lead 101' }).count(), 1);
  assert.equal(await page.getByRole('dialog').locator('dt', { hasText: 'Due date used here' }).count(), 1);
  assert.equal(await page.getByRole('dialog').locator('dt', { hasText: 'First contact due' }).count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await review.evaluate(node => node === document.activeElement), true);
  await page.getByRole('button', { name: 'Critical only' }).click();
  assert.equal(await page.locator('.lanes .priority:not(.critical)').count(), 0);
  await page.getByRole('button', { name: 'Critical only' }).click();

  await page.locator('[data-metric="awaitingFirst"]').click();
  assert.equal(await page.getByRole('dialog').getByText('Sample Lead 101', { exact: true }).count(), 1);
  assert.equal(await page.getByRole('dialog').getByText('PH-DEMO-101', { exact: true }).count(), 0);
  await page.keyboard.press('Escape');
  const triage = page.getByRole('region', { name: 'Why leads need attention', exact: true });
  assert.equal(await triage.locator('tbody tr').count(), 2);
  await triage.getByRole('button', { name: 'Sale needs checking', exact: true }).click();
  assert.equal(await page.locator('#issue').inputValue(), 'attention');
  await page.getByText('2 matching leads', { exact: true }).waitFor();
  assert.deepEqual(await page.locator('.lanes [data-record]').evaluateAll(nodes => nodes.map(node => node.dataset.record).sort()), ['PH-DEMO-105', 'PH-DEMO-106']);
  const clear = page.getByRole('button', { name: 'Clear reason', exact: true });
  await page.getByRole('combobox', { name: 'New leads from' }).selectOption('1');
  await page.getByText('2 matching leads', { exact: true }).waitFor();
  await page.getByRole('combobox', { name: 'Lead source' }).selectOption({ label: 'Demo form' });
  await triage.getByText('No leads need attention with these filters.', { exact: true }).waitFor();
  await page.getByText('0 matching leads', { exact: true }).waitFor();
  await clear.click();
  assert.equal(await clear.count(), 0);
  await page.getByRole('combobox', { name: 'Lead source' }).selectOption('');

  const overdue = page.locator('#attention').getByRole('button', { name: /Overdue actions/ });
  await overdue.click();
  assert.equal(await page.locator('#issue').inputValue(), 'overdue');
  await page.getByRole('combobox', { name: 'New leads from' }).selectOption('1');
  assert.equal(await page.locator('[data-metric="newLeads"] strong').innerText(), '1');
  await page.getByRole('combobox', { name: 'Lead source' }).selectOption({ label: 'Demo web' });
  assert.equal(await page.locator('[data-metric="newLeads"] strong').innerText(), '0');
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.getByText('Synthetic data loaded.', { exact: true }).waitFor();
  for (const width of [320, 360, 390, 720, 1440]) {
    await page.setViewportSize({ width, height: 850 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth) <= width);
  }
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
});

test('Executive overview filters and sorts aggregate reports without losing the Daily Operations queue', async t => {
  const { page, base } = await start(t, { viewport: { width: 1440, height: 980 } });
  const errors = [];
  const external = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    if (route.request().url().startsWith(base + '/')) return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto(base + '/app/widget.html');
  await page.getByText('Synthetic data loaded.', { exact: true }).waitFor();
  const search = page.getByRole('searchbox', { name: 'Find a lead' });
  await search.fill('sample lead 107');
  await page.getByRole('link', { name: 'Executive Overview', exact: true }).click();
  await page.getByRole('heading', { name: 'Philippine sales & dealer performance' }).waitFor();
  assert.equal(await page.getByRole('region', { name: 'Work queue' }).isVisible(), false);
  const trend = page.getByRole('region', { name: 'Activity over time' });
  const chartState = () => trend.locator('canvas').evaluate(canvas => {
    const chart = window.Chart.getChart(canvas);
    return { id: chart.id, type: chart.config.type, series: chart.data.datasets.map(dataset => dataset.data),
      visible: chart.data.datasets.map((_, index) => chart.isDatasetVisible(index)), animation: chart.options.animation !== false };
  });
  const initial = await chartState();
  assert.equal(initial.type, 'line');
  assert.deepEqual(initial.series.map(values => values.reduce((total, value) => total + value, 0)), [8, 6]);
  const updates = trend.getByRole('button', { name: 'First dealer updates', exact: true });
  await updates.focus();
  await page.keyboard.press('Enter');
  assert.equal(await updates.getAttribute('aria-pressed'), 'false');
  assert.deepEqual((await chartState()).visible, [true, false]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.Chart.getChart(document.querySelector('#exec-chart canvas')).options.animation === false);
  const scorecard = page.getByRole('region', { name: 'Management scorecard' });
  assert.match(await scorecard.innerText(), /9 leads visible in PH - Central CRM Leads/);
  assert.match(await scorecard.innerText(), /7 more than prior period/);
  const dealers = page.getByRole('region', { name: 'Dealer comparison table' });
  const assignment = page.getByRole('region', { name: 'Assigned leads by dealer contact' });
  const mixState = () => assignment.locator('canvas').evaluate(canvas => {
    const chart = window.Chart.getChart(canvas);
    return { type: chart.config.type, data: chart.data.datasets[0].data };
  });
  assert.deepEqual(await mixState(), { type: 'doughnut', data: [4, 3] });
  assert.equal(await assignment.locator('#assignment-total').textContent(), '7');
  assert.deepEqual(await assignment.locator('.assignment-share').allTextContents(), ['57.1%', '42.9%']);
  const assignedCounts = await dealers.locator('tbody td:nth-child(2)').allTextContents();
  assert.equal(assignedCounts.reduce((total, count) => total + Number(count), 0), 7);
  assert.deepEqual(await dealers.locator('tbody th').allTextContents(), ['Demo Visayas desk', 'Demo Metro desk']);
  await dealers.getByRole('button', { name: 'Dealer contact' }).click();
  assert.deepEqual(await dealers.locator('tbody th').allTextContents(), ['Demo Metro desk', 'Demo Visayas desk']);
  await dealers.getByRole('button', { name: 'Dealer contact' }).click();
  assert.equal(await dealers.locator('th[aria-sort]').getAttribute('aria-sort'), 'descending');
  assert.deepEqual(await mixState(), { type: 'doughnut', data: [4, 3] });
  const stages = page.getByRole('region', { name: 'Current lead stages' });
  for (const dimension of await stages.locator('dl').all()) {
    assert.equal(await dimension.locator('dd').allTextContents().then(items => items.reduce((total, item) => total + Number(item), 0)), 9);
  }
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('1');
  await page.getByRole('combobox', { name: 'Lead dates' }).selectOption('period');
  await page.getByText('No leads with an assigned dealer contact match these filters.').waitFor();
  assert.equal(await assignment.isVisible(), false);
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('30');
  assert.equal((await chartState()).type, 'bar');
  assert.equal((await chartState()).animation, false);
  const groupedId = (await chartState()).id;
  await page.getByRole('combobox', { name: 'Lead source' }).selectOption({ label: 'Demo form' });
  assert.equal((await chartState()).id, groupedId);
  assert.deepEqual((await chartState()).visible, [true, false]);
  assert.deepEqual(await dealers.locator('tbody th').allTextContents(), ['Demo Visayas desk']);
  assert.deepEqual(await mixState(), { type: 'doughnut', data: [1] });
  assert.equal(await assignment.locator('#assignment-total').textContent(), '1');
  await page.setViewportSize({ width: 320, height: 820 });
  assert.equal(await dealers.evaluate(node => node.scrollWidth > node.clientWidth), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320);
  await page.getByRole('combobox', { name: 'Reporting period' }).selectOption('7');
  await page.getByRole('combobox', { name: 'Lead source' }).selectOption('');
  await page.getByRole('link', { name: 'Daily Operations', exact: true }).click();
  await page.getByRole('heading', { name: 'CRM handoff board' }).waitFor();
  assert.equal(await search.inputValue(), 'sample lead 107');
  await page.getByText('1 matching lead', { exact: true }).waitFor();
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
});

test('The exact daily counts remain available without the chart library', async t => {
  const { page, base } = await start(t);
  await page.route(base + '/app/assets/chart.js', route => route.abort());
  await page.goto(base + '/app/widget.html');
  await page.getByText('Synthetic data loaded.', { exact: true }).waitFor();
  const trend = page.getByRole('region', { name: 'New leads and first dealer updates' });
  await trend.getByText('Open the table below for exact counts.').waitFor();
  await trend.getByText('Daily counts', { exact: true }).click();
  const table = trend.getByRole('region', { name: 'Daily counts in Manila time' });
  assert.equal(await table.locator('tbody tr').count(), 7);
});

test('Embedded Home loads automatically, supports Refresh and Retry, and keeps live errors separate from demo data', async t => {
  const { page, base } = await start(t, { viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
  const widget = 'https://widget.example.test';
  const sdk = 'https://live.zwidgets.com/js-sdk/1.5/ZohoEmbededAppSDK.min.js';
  let requestedSDK = 0;
  let requestedMock = 0;
  const record = {
    Created_Time: '2025-07-24T08:00:00+08:00', Assigned_PH_Dealer_Contact: null,
    PH_Workflow_Stage: 'New', Lead_Stage: 'Prospect', PH_Latest_Dealer_Outcome: null,
    Next_Action_Due: null, First_Dealer_Update_At: null, PH_First_Contact_SLA_Due: null,
    PH_Workflow_Enabled: true, PH_Last_Dealer_Follow_up_At: null, PH_Attention_Required: false, PH_Attention_Reason: null,
  };
  const records = [
    { ...record, id: '1234567890123456791', Full_Name: '<Sample & Co> With a Long Test Name', Lead_Source: 'Fixture Website' },
    { ...record, id: '1234567890123456792', Lead_Source: null, PH_Attention_Required: true, PH_Attention_Reason: 'Assistance Needed',
      Assigned_PH_Dealer_Contact: { id: '1234567890123456794', name: 'Fixture dealer desk' } },
  ];
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url === base + '/host') return route.fulfill({ contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}iframe{width:100%;height:630px;border:0}</style><iframe title="Dashboard" src="' + widget + '/widget.html"></iframe>' });
    if (url === sdk) {
      requestedSDK++;
      return route.fulfill({ contentType: 'text/javascript', body: `
        window.ZOHO = { embeddedApp: { init: async () => { window.initialized = true } },
          CRM: { UI: { Record: { open: async input => { window.openedRecord = input; return true; } } } } };
        window.zrc = { get: async (path, {params}) => {
            if (!window.initialized || path !== '/crm/v8/Leads' || params.cvid !== '1234527000030478107' ||
                !params.fields.split(',').includes('Lead_Source') || 'sort_by' in params) throw Error('Unsafe query');
            window.lastRequest = {path, params};
            window.queryCount = (window.queryCount || 0) + 1;
            if (window.queryCount === 1 || window.holdRead) await new Promise(resolve => { window.completeFirstRead = resolve; });
            if (window.denied) throw { name: 'ApiError', status: 400, details: { code: 'INVALID_REQUEST' } };
            if (window.emptyView) return {status: 204};
            const rows = ${JSON.stringify(records)};
            return {status: 200, data: { data: rows, info: { more_records: false, count: rows.length } }};
          } };
      ` });
    }
    if (url === widget + '/js/data/mock.js') requestedMock++;
    if (url.startsWith(widget + '/')) return route.fulfill({ response: await page.request.get(base + '/app' + url.slice(widget.length)) });
    return route.abort();
  });
  await page.goto(base + '/host');
  const frame = page.frameLocator('iframe');
  const loading = frame.getByRole('progressbar', { name: 'Loading dashboard' });
  const refresh = frame.getByRole('button', { name: 'Refresh' });
  const retry = frame.getByRole('button', { name: 'Retry', exact: true });
  await loading.waitFor({ timeout: 5000 });
  const skeleton = frame.locator('#loading-skeleton');
  await frame.locator('#daily-skeleton').waitFor();
  assert.equal(await skeleton.getAttribute('aria-hidden'), 'true');
  assert.equal(await frame.locator('#executive-skeleton').isVisible(), false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await frame.locator('#daily-skeleton').evaluate(node => getComputedStyle(node).animationName), 'none');
  await frame.getByRole('link', { name: 'Executive Overview', exact: true }).click();
  await frame.locator('#executive-skeleton').waitFor();
  assert.equal(await frame.locator('#daily-skeleton').isVisible(), false);
  await frame.getByRole('link', { name: 'Daily Operations', exact: true }).click();
  await frame.locator('#daily-skeleton').waitFor();
  assert.equal(await refresh.isDisabled(), true);
  assert.equal(await frame.locator('#content').isVisible(), false);
  assert.equal(await retry.isVisible(), false);
  assert.equal(await frame.locator('#authorize-live, #start-live, #preview-demo').count(), 0);
  await frame.getByText('LIVE · READ ONLY', { exact: true }).waitFor();
  const embedded = page.frames().find(item => item.url().startsWith(widget));
  await embedded.waitForFunction(() => typeof window.completeFirstRead === 'function');
  assert.equal(await embedded.evaluate(() => window.lastRequest.params.cvid), '1234527000030478107');
  assert.equal(requestedSDK, 1);
  await embedded.evaluate(() => window.completeFirstRead());
  await frame.getByText('2 leads loaded', { exact: true }).waitFor();
  assert.equal(await skeleton.isVisible(), false);
  await frame.getByRole('link', { name: 'Executive Overview', exact: true }).click();
  await frame.getByText(/2 leads visible in PH - Central CRM Leads/).waitFor();
  assert.equal(await embedded.evaluate(() => window.queryCount), 1);
  await frame.getByRole('link', { name: 'Daily Operations', exact: true }).click();
  await frame.getByRole('heading', { name: 'CRM handoff board' }).waitFor();
  assert.equal(await frame.locator('#content').isVisible(), true);
  assert.equal(await loading.isVisible(), false);
  assert.equal(await refresh.isEnabled(), true);
  assert.equal(await frame.locator('html').evaluate(node => node.clientWidth), 320);
  assert.equal(await frame.locator('html').evaluate(node => node.scrollWidth), 320);
  const laneBoxes = await frame.locator('.lanes > section').evaluateAll(lanes =>
    lanes.map(lane => ({ top: lane.getBoundingClientRect().top, left: lane.getBoundingClientRect().left })));
  assert.ok(laneBoxes[0].top < laneBoxes[1].top && laneBoxes[1].top < laneBoxes[2].top);
  assert.ok(laneBoxes.every(lane => lane.left === laneBoxes[0].left));
  const issue = frame.getByRole('combobox', { name: 'Issue type' });
  assert.ok((await issue.boundingBox()).height >= 44);
  const review = frame.getByRole('button', { name: 'Review <Sample & Co> With a Long Test Name', exact: true });
  assert.ok((await review.boundingBox()).height >= 44);
  await review.tap();
  const detail = frame.getByRole('dialog');
  assert.equal(await detail.getByRole('heading', { name: '<Sample & Co> With a Long Test Name' }).count(), 1);
  assert.ok((await detail.boundingBox()).width <= 320);
  const close = detail.getByRole('button', { name: 'Close' });
  assert.ok((await close.boundingBox()).height >= 44);
  await close.tap();
  assert.equal(await detail.isVisible(), false);
  const dealerTable = frame.getByRole('region', { name: 'Dealer follow-up table' });
  assert.ok(await dealerTable.evaluate(node => node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX === 'auto'));
  const attentionReason = frame.getByRole('button', { name: 'Needs help', exact: true });
  assert.ok((await attentionReason.boundingBox()).height >= 44);
  await attentionReason.tap();
  await frame.getByText('1 matching lead', { exact: true }).waitFor();
  await issue.selectOption('');
  const leadSource = frame.getByRole('combobox', { name: 'Lead source' });
  await leadSource.selectOption({ label: 'Fixture Website' });
  assert.equal(await frame.locator('[data-metric="unassigned"] strong').innerText(), '1');
  await review.click();
  await detail.getByRole('button', { name: 'Open Lead in CRM' }).click();
  assert.deepEqual(await embedded.evaluate(() => window.openedRecord), { Entity: 'Leads', RecordID: '1234567890123456791' });
  await close.tap();
  await leadSource.selectOption({ label: 'Not recorded' });
  assert.equal(await frame.getByRole('button', { name: 'Review Name unavailable' }).count(), 1);
  assert.equal(await embedded.evaluate(() => window.queryCount), 1);
  await embedded.evaluate(() => { window.denied = true; window.holdRead = true; window.completeFirstRead = null; });
  await refresh.click();
  await frame.locator('#daily-skeleton').waitFor();
  await embedded.waitForFunction(() => typeof window.completeFirstRead === 'function');
  await embedded.evaluate(() => { window.holdRead = false; window.completeFirstRead(); });
  await frame.getByText('Could not load leads from Zoho CRM. Try again.', { exact: true }).waitFor();
  assert.equal(await skeleton.isVisible(), false);
  await frame.getByText('Error details', { exact: true }).click();
  await frame.getByText(/INVALID_REQUEST.*HTTP 400.*GET \/crm\/v8\/Leads.*1234527000030478107.*page 1/).waitFor();
  assert.equal(requestedSDK, 1);
  assert.equal(await frame.locator('#content').isVisible(), false);
  assert.equal(await leadSource.isDisabled(), true);
  assert.deepEqual(await leadSource.locator('option').allTextContents(), ['All sources']);
  assert.equal(await frame.getByText('DEMO DATA', { exact: true }).count(), 0);
  assert.equal(await frame.getByRole('button', { name: 'Preview demo data' }).isVisible(), false);
  assert.equal(await frame.getByText('LIVE · READ ONLY', { exact: true }).count(), 1);
  assert.equal(await loading.isVisible(), false);
  assert.equal(await retry.isVisible(), true);
  await embedded.evaluate(() => { window.denied = false; });
  await retry.tap();
  await frame.getByText('2 leads loaded', { exact: true }).waitFor();
  assert.equal(await frame.locator('#content').isVisible(), true);
  assert.equal(await retry.isVisible(), false);
  await embedded.evaluate(() => { window.emptyView = true; });
  await refresh.click();
  await frame.getByText('No leads in PH - Central CRM Leads are visible to this user.', { exact: true }).waitFor();
  assert.equal(await retry.isVisible(), false);
  assert.equal(await embedded.evaluate(() => window.queryCount), 4);
  assert.equal(requestedSDK, 1);
  await page.reload();
  const reopened = page.frames().find(item => item.url().startsWith(widget));
  await reopened.waitForFunction(() => typeof window.completeFirstRead === 'function');
  await reopened.evaluate(() => window.completeFirstRead());
  await frame.getByText('2 leads loaded', { exact: true }).waitFor();
  assert.equal(await reopened.evaluate(() => window.queryCount), 1);
  assert.equal(requestedSDK, 2);
  assert.equal(requestedMock, 0);
});
