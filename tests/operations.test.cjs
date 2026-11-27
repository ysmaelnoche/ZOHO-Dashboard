const { test } = require('node:test');
const assert = require('node:assert/strict');

const now = Date.parse('2026-11-27T11:00:00+08:00');
const at = value => Date.parse('2026-11-' + value + '+08:00');
const lead = (id, changes = {}) => ({
  id: String(id), name: null, created: at('24T08:00:00'), dealer: { id: '201', name: 'Fixture Dealer Desk' },
  workflow: 'With Dealer', stage: 'Opportunity', outcome: null, enabled: true,
  nextDue: null, firstUpdate: null, firstDue: at('26T08:00:00'), lastFollowUp: null,
  attention: false, reason: null, source: null, ...changes,
});

test('Central CRM counts reconcile and keep operational stage separate from sales progression', async () => {
  const { summarize, manilaDay } = await import('../app/js/data/dashboard.js');
  const { liveSettings } = await import('../app/js/live-settings.js');
  assert.equal(liveSettings.viewId, '1234527000030478107');
  const rows = [
    lead(1, { outcome: 'Contacted - Interested', firstUpdate: at('25T10:00:00'), attention: true }),
    lead(2, { outcome: 'Contacted - Follow-up Needed', nextDue: at('27T18:00:00') }),
    lead(3),
    lead(4, { dealer: null, workflow: 'New', stage: 'Prospect' }),
    lead(5, { outcome: 'Not Interested', stage: 'Not Sold', firstUpdate: at('25T10:00:00') }),
    lead(6, { workflow: 'Closed', stage: 'Lost', outcome: 'Contacted - Interested', nextDue: at('25T13:00:00') }),
    lead(7, { workflow: 'Unmapped workflow' }),
    lead(8, { enabled: false, workflow: 'Central Review', stage: 'Sales follow-up', dealer: null }),
    lead(9, { outcome: 'Sale Reported', attention: true, reason: 'Sale Verification', firstUpdate: at('25T10:00:00') }),
    lead(10, { created: at('27T00:00:00'), firstUpdate: at('27T04:00:00'), nextDue: at('27T09:00:00') }),
    lead(11, { created: at('26T23:59:59'), firstUpdate: at('27T08:00:00'), firstDue: at('27T08:00:00'), stage: 'Sold' }),
    lead(12, { outcome: 'Contacted - Interested', nextDue: null }),
    lead(13, { outcome: 'Sale Reported', firstUpdate: at('26T12:00:00') }),
    lead(14, { workflow: 'Central Review', attention: true, dealer: null }),
  ];
  const report = summarize(rows, liveSettings.policy, now, 1);
  assert.equal(manilaDay(now), '2026-11-27');
  assert.equal(report.metrics.total, 14);
  assert.equal(report.metrics.newLeads, 1);
  assert.equal(report.metrics.centralReview, 2);
  assert.equal(report.metrics.assigned, 9);
  assert.equal(report.metrics.unassigned, 2);
  assert.equal(report.metrics.opportunities, 8);
  assert.equal(report.metrics.overdue, 2);
  assert.equal(report.metrics.dueToday, 1);
  assert.equal(report.metrics.interested, 2);
  assert.equal(report.metrics.missingFollowUp, 2);
  assert.equal(report.metrics.awaitingFirst, 1);
  assert.equal(report.metrics.verification, 1);
  assert.equal(report.metrics.unmapped, 1);
  assert.equal(report.activity[0].firstUpdates, 2);
  assert.equal(report.salesStages.reduce((count, row) => count + row.count, 0), 14);
  assert.equal(report.salesStages.find(row => row.label === 'Sold').count, 1);
  assert.deepEqual(report.queue.find(row => row.lead.id === '1').kinds, ['missing-follow-up', 'attention']);
  assert.equal(report.queue.find(row => row.lead.id === '2').deadline, at('27T18:00:00'));
  assert.equal(report.queue.find(row => row.lead.id === '3').deadline, at('26T08:00:00'));
  assert.equal(report.queue.find(row => row.lead.id === '9').desk, 'verification');
  assert.ok(!report.queue.some(row => ['5', '6', '11', '13'].includes(row.lead.id)));
  assert.equal(report.queue.length, new Set(report.queue.map(row => row.lead.id)).size);
  assert.equal(report.dealers[0].assigned, report.metrics.assigned);
});

test('Attention triage reconciles flags across intake dates and uses the current work deadline', async () => {
  const { summarize } = await import('../app/js/data/dashboard.js');
  const { liveSettings } = await import('../app/js/live-settings.js');
  const rows = [
    lead(1, { attention: true, reason: 'First Contact Overdue', created: at('20T09:00:00') }),
    lead(2, { attention: true, reason: 'First Contact Overdue', firstUpdate: at('25T08:00:00'), nextDue: at('27T18:00:00') }),
    lead(3, { attention: true, reason: 'First Contact Overdue', workflow: 'Closed' }),
    lead(4, { attention: true, reason: 'Unverified reason', nextDue: at('25T08:00:00'), firstUpdate: at('24T08:00:00') }),
    lead(5, { attention: true, reason: null, enabled: false }),
    lead(6, { reason: 'First Contact Overdue' }),
  ];
  const report = summarize(rows, liveSettings.policy, now, 1);
  const groups = report.attentionGroups;
  assert.deepEqual(groups.map(({ label, count, overdue }) => [label, count, overdue]), [
    ['First Contact Overdue', 3, 1], ['Unmapped reason', 1, 1], ['Reason not recorded', 1, 0],
  ]);
  assert.equal(groups[0].oldestCreated, at('20T09:00:00'));
  assert.equal(groups.reduce((count, row) => count + row.count, 0), report.metrics.attention);
  assert.deepEqual(report.queue.filter(row => row.attentionGroup === groups[0].key).map(row => row.lead.id), ['1', '2', '3']);
  assert.deepEqual(groups, summarize(rows, liveSettings.policy, now, 30).attentionGroups);
  assert.deepEqual(summarize([], liveSettings.policy, now, 1).attentionGroups, []);
});

test('Executive counts reconcile by lead ID and dealer contact across Manila reporting periods', async () => {
  const { summarizeExecutive } = await import('../app/js/data/executive.js');
  const { summarize } = await import('../app/js/data/dashboard.js');
  const { liveSettings: { policy } } = await import('../app/js/live-settings.js');
  const sameLabel = { id: '202', name: 'Fixture Dealer Desk' };
  const rows = [
    lead(1, { created: at('27T00:00:00'), outcome: 'Contacted - Interested', firstUpdate: at('27T08:00:00'), nextDue: at('27T10:00:00'), source: 'Web' }),
    lead(2, { created: at('26T11:00:00'), dealer: sameLabel, workflow: 'Closed', stage: 'Sold', firstUpdate: at('27T07:00:00') }),
    lead(3, { created: at('26T11:00:01'), outcome: 'Contacted - Follow-up Needed' }),
    lead(4, { created: at('27T08:00:00'), dealer: null, workflow: 'New', stage: 'Prospect', source: 'Web' }),
    lead(5, { dealer: sameLabel, outcome: 'Sale Reported', attention: true, reason: 'Sale Verification', nextDue: at('26T12:00:00'), workflow: 'With Dealer' }),
    lead(6, { workflow: 'Unmapped', stage: null, firstUpdate: at('27T13:00:00') }),
    lead(7, { outcome: 'Contacted - Interested', workflow: 'Central Review', nextDue: at('26T12:00:00') }),
    lead(8, { firstDue: at('26T12:00:00') }),
    lead(9, { created: at('27T12:00:00') }),
  ];
  const scoped = rows.slice(0, -1);
  const report = summarizeExecutive([...rows, rows[0]], policy, now, 1);
  const daily = summarize(scoped, policy, now, 1);
  assert.deepEqual(report.totals, {
    leads: 8, assigned: 7, firstUpdates: 2, openUnassigned: 1, opportunities: daily.metrics.opportunities,
    followUps: 2, overdueFollowUps: 1, missingNextAction: 1,
  });
  assert.equal(report.activity.current.created, 2);
  assert.equal(report.activity.previous.created, 1);
  assert.equal(report.activity.current.updates, 2);
  assert.equal(report.activity.previous.updates, 0);
  assert.deepEqual(report.sources.map(({ source, current, previous }) => [source, current, previous]), [['Web', 2, 0], [null, 0, 1]]);
  assert.deepEqual(report.dealers.map(row => [row.contact.id, row.all.assigned, row.period.assigned, row.all.activity, row.all.sold]), [
    ['201', 5, 1, 1, 0], ['202', 2, 0, 1, 1],
  ]);
  assert.equal(report.dealers.reduce((count, row) => count + row.all.awaiting, 0), daily.metrics.awaitingFirst);
  const count = rows => rows.reduce((total, row) => total + row.count, 0);
  assert.equal(count(report.salesStages), report.totals.leads);
  assert.equal(count(report.workflowStages), report.totals.leads);
  assert.equal(report.salesStages.find(row => row.label === 'Sold').count, 1);
  assert.equal(report.workflowStages.find(row => row.label === 'Not recorded or unrecognized').count, 1);
  const monthly = summarizeExecutive(scoped, policy, now, 30);
  assert.equal(monthly.activity.buckets.length, 5);
  assert.equal(monthly.activity.buckets.reduce((total, bucket) => total + bucket.created, 0), 8);
  assert.deepEqual(summarizeExecutive([], policy, now, 7).dealers, []);
});

test('Assignment share keeps the five largest contacts and reconciles the remainder', async () => {
  const { summarizeAssignments } = await import('../app/js/data/executive.js');
  const assignments = [0, 2, 7, 5, 3, 4, 6, 1].map(count => ({ label: 'Contact ' + count, count }));
  const { total, slices } = summarizeAssignments(assignments);
  assert.equal(total, 28);
  assert.deepEqual(slices.map(row => row.count), [7, 6, 5, 4, 3, 3]);
  assert.equal(slices.at(-1).label, 'Other contacts (2)');
  assert.deepEqual(summarizeAssignments([]), { total: 0, slices: [] });
});

test('REST v8 uses the approved view, explicit fields and a ZRC page token without overriding view sort', async () => {
  const { createZohoAdapter } = await import('../app/js/data/zoho.js');
  const { liveSettings } = await import('../app/js/live-settings.js');
  const record = id => ({
    id, Full_Name: '  Sample Lead  ', Created_Time: '2026-11-24T08:00:00+08:00', Assigned_PH_Dealer_Contact: null, Lead_Source: 'Fixture source',
    PH_Workflow_Stage: 'New', Lead_Stage: 'Prospect', PH_Latest_Dealer_Outcome: null,
    Next_Action_Due: null, First_Dealer_Update_At: null, PH_First_Contact_SLA_Due: null,
    PH_Workflow_Enabled: true, PH_Last_Dealer_Follow_up_At: null, PH_Attention_Required: false, PH_Attention_Reason: null,
  });
  const calls = [];
  const ids = ['1234567890123456792', '1234567890123456791'];
  const token = 'fixture+token/next=';
  const pageResponse = (rows, more = false, next = null) => ({
    status: 200, data: { data: rows, info: { more_records: more, count: rows.length, next_page_token: next } },
  });
  const snapshot = await createZohoAdapter(async (path, options) => {
    const index = calls.push([path, options.params]) - 1;
    const row = record(ids[index]);
    if (index === 1) delete row.Full_Name;
    return pageResponse([row], index === 0, index === 0 ? token : null);
  }, liveSettings).load();
  assert.deepEqual(snapshot.leads.map(row => row.id), ids);
  assert.deepEqual(snapshot.leads.map(row => row.name), ['Sample Lead', null]);
  assert.deepEqual(snapshot.leads.map(row => row.source), ['Fixture source', 'Fixture source']);
  const fields = Object.keys(record(ids[0])).filter(name => name !== 'id').sort();
  assert.equal(calls.length, 2);
  for (const [path, params] of calls) {
    assert.equal(path, '/crm/v8/Leads');
    assert.equal(params.cvid, '1234527000030478107');
    assert.equal(params.per_page, 200);
    assert.deepEqual(params.fields.split(',').sort(), fields);
    assert.equal('sort_by' in params || 'sort_order' in params || 'page' in params, false);
  }
  assert.equal('page_token' in calls[0][1], false);
  assert.deepEqual(calls[1][1], { ...calls[0][1], page_token: token });

  await assert.rejects(createZohoAdapter(async () => pageResponse([record(ids[0])], true), liveSettings).load(), /pagination/i);
  await assert.rejects(createZohoAdapter(async () => {
    const result = pageResponse([record(ids[0])]);
    result.data.info.count = 2;
    return result;
  }, liveSettings).load(), /pagination/i);
  await assert.rejects(createZohoAdapter(async () => pageResponse([{ id: ids[0] }]), liveSettings).load(), /field/i);
  const afterFirstPage = nextResponse => createZohoAdapter(async (_path, { params }) =>
    params.page_token ? nextResponse : pageResponse([record(ids[0])], true, token), liveSettings).load();
  await assert.rejects(afterFirstPage({ status: 204 }), /pagination/i);
  await assert.rejects(afterFirstPage(pageResponse([record(ids[0])])), /duplicate/i);
  await assert.rejects(afterFirstPage(pageResponse([record(ids[1])], true, token)), /pagination/i);
  const empty = await createZohoAdapter(async () => ({ status: 204 }), liveSettings).load();
  assert.deepEqual(empty.leads, []);
});

test('ZRC errors retain safe Zoho diagnostics without exposing response details', async () => {
  const { createZohoAdapter } = await import('../app/js/data/zoho.js');
  const { liveSettings } = await import('../app/js/live-settings.js');
  await assert.rejects(createZohoAdapter(async () => {
    throw { name: 'ApiError', status: 400, details: { code: 'INVALID_REQUEST', message: 'fixture-private-message' } };
  }, liveSettings).load(), error => {
    assert.match(error.message, /INVALID_REQUEST.*HTTP 400.*GET \/crm\/v8\/Leads.*1234527000030478107.*page 1/);
    assert.doesNotMatch(error.message, /fixture-private-message/);
    return true;
  });
  await assert.rejects(createZohoAdapter(async () => ({
    status: 403, data: { code: 'NO_PERMISSION' },
  }), liveSettings).load(), /CRM denied access.*NO_PERMISSION.*HTTP 403/i);
  await assert.rejects(createZohoAdapter(async () => {
    throw Object.assign(new Error('Request failed with status code 400. fixture-private-message'), { name: 'API_ERROR' });
  }, liveSettings).load(), /API_ERROR.*HTTP 400/);
});
