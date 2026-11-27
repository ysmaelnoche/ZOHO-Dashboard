import type { DealerCounts, ExecutiveReport } from '../data/executive.js';
import { byId, escape, table } from './common.js';
import { ActivityChart } from './activity-chart.js';
import { AssignmentMix } from './assignment-mix.js';

const counts = new Intl.NumberFormat('en-PH');
const date = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
const formatCount = (count: number) => counts.format(count);
const range = (start: number, end: number) => date.format(start) === date.format(end)
  ? date.format(start) : date.format(start) + ' – ' + date.format(end);
const change = (value: number, previous: number) => {
  const difference = value - previous;
  return difference === 0 ? 'Same as prior period' :
    formatCount(Math.abs(difference)) + (difference > 0 ? ' more than prior period' : ' fewer than prior period');
};

const dealerColumns: [keyof DealerCounts, string][] = [
  ['assigned', 'Assigned'], ['open', 'Open'], ['updated', 'First update recorded'], ['activity', 'Activity in period'],
  ['awaiting', 'Waiting for first update'],
  ['opportunities', 'Opportunities'], ['followUps', 'Follow-ups needed'], ['overdue', 'Past due'],
  ['missingDate', 'No follow-up date'], ['sold', 'Sold stage'],
];

export class ExecutiveOverview {
  private report?: ExecutiveReport;
  private readonly scope = byId<HTMLSelectElement>('exec-dealer-scope');
  private readonly dealerResults = byId('exec-dealer-results');
  private readonly trend = new ActivityChart(byId('exec-chart'));
  private readonly assignmentMix = new AssignmentMix();
  private sort: keyof DealerCounts | 'contact' = 'overdue';
  private descending = true;

  constructor() {
    this.scope.addEventListener('change', () => this.renderDealers());
    this.dealerResults.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLButtonElement>('button[data-column]');
      if (!button) return;
      const column = button.dataset.column as typeof this.sort;
      this.descending = this.sort === column ? !this.descending : column !== 'contact';
      this.sort = column;
      this.renderDealers(false);
      this.dealerResults.querySelector<HTMLButtonElement>('[data-column="' + column + '"]')?.focus({ preventScroll: true });
    });
  }

  render(report: ExecutiveReport) {
    this.report = report;
    const { totals, activity } = report;
    const headline: [string, number, string][] = [
      ['New leads', activity.current.created, change(activity.current.created, activity.previous.created)],
      ['Open leads without a dealer', totals.openUnassigned, 'Across all lead dates'],
      ['Active opportunities', totals.opportunities, 'Current Opportunity stage'],
      ['Overdue follow-ups', totals.overdueFollowUps,
        formatCount(totals.followUps) + ' need follow-up · ' + formatCount(totals.missingNextAction) + ' have no date'],
    ];
    byId('exec-scorecard').innerHTML =
      '<header class="section-head"><h2>Sales workflow at a glance</h2><p>' + formatCount(totals.leads) +
      ' leads visible in PH - Central CRM Leads across all dates. This view excludes leads marked as dealer-created.</p></header>' +
      (totals.leads ? '<dl class="executive-kpis">' + headline.map(([label, count, note]) =>
        '<div><dt>' + label + '</dt><dd><strong>' + formatCount(count) + '</strong><span>' + note + '</span></dd></div>').join('') +
        '</dl><p class="executive-context"><strong>' + formatCount(totals.assigned) +
        '</strong> currently assigned <span>·</span> <strong>' + formatCount(totals.leads - totals.assigned) +
        '</strong> with no dealer on record <span>·</span> <strong>' + formatCount(totals.firstUpdates) +
        '</strong> with a first update on record</p>' :
        '<p class="empty">No leads match this view and source selection.</p>');
    for (const id of ['exec-dealers', 'exec-stages', 'exec-activity', 'exec-sources']) byId(id).hidden = totals.leads === 0;
    if (!totals.leads) return;

    this.renderDealers();
    this.renderStages(report);
    this.renderActivity(activity);
    byId('exec-sources').innerHTML =
      '<header class="section-head"><h2>New leads by source</h2><p>Based on when leads were added to CRM. Both periods end at the same Manila time of day.</p></header>' +
      (report.sources.length ? table('New leads by source', [
        'Lead source', range(activity.start, activity.asOf), range(activity.previousStart, activity.previousEnd),
      ], report.sources.map(row => [row.source ?? 'Not recorded', formatCount(row.current), formatCount(row.previous)])) :
        '<p class="empty">No new leads in either reporting window.</p>');
  }

  private renderDealers(updateMix = true) {
    if (!this.report) return;
    const { activity, dealers } = this.report;
    const scope = this.scope.value === 'period' ? 'period' : 'all';
    const rows = dealers.map(row => ({ contact: row.contact, counts: row[scope] })).filter(row => row.counts.assigned > 0);
    const sort = this.sort;
    const direction = this.descending ? -1 : 1;
    rows.sort((a, b) => {
      const comparison = sort === 'contact' ? a.contact.name.localeCompare(b.contact.name) : a.counts[sort] - b.counts[sort];
      return direction * comparison || b.counts.awaiting - a.counts.awaiting || a.contact.name.localeCompare(b.contact.name);
    });
    const heading = (key: typeof this.sort, label: string) => {
      const order = this.sort === key ? ' aria-sort="' + (this.descending ? 'descending' : 'ascending') + '"' : '';
      return '<th scope="col"' + order + '><button type="button" data-column="' + key + '">' + label + '</button></th>';
    };
    const scopeText = scope === 'period' ? 'Leads created ' + range(activity.start, activity.asOf) :
      'Leads from all dates';
    const names = new Map<string, number>();
    for (const row of rows) names.set(row.contact.name, (names.get(row.contact.name) ?? 0) + 1);
    if (updateMix) this.assignmentMix.render(rows.map(({ contact, counts }) => ({
      label: (names.get(contact.name) ?? 0) > 1 ? contact.name + ' · …' + contact.id.slice(-6) : contact.name,
      count: counts.assigned,
    })));
    this.dealerResults.innerHTML = '<p class="executive-context">' + scopeText + ' · ' +
      formatCount(rows.length) + (rows.length === 1 ? ' assigned contact' : ' assigned contacts') + ' · Activity ' +
      range(activity.start, activity.asOf) + '</p>' +
      (rows.length ? '<p class="executive-scroll-note">Scroll across to see all columns.</p>' +
        '<div class="table-scroll" tabindex="0" role="region" aria-label="Dealer comparison table">' +
        '<table class="executive-dealer-table"><thead><tr>' + heading('contact', 'Dealer contact') +
        dealerColumns.map(([key, label]) => heading(key, label)).join('') + '</tr></thead><tbody>' +
        rows.map(row => '<tr><th scope="row">' + escape(row.contact.name) +
          ((names.get(row.contact.name) ?? 0) > 1 ? '<small>Contact …' + escape(row.contact.id.slice(-6)) + '</small>' : '') +
          '</th>' + dealerColumns.map(([key]) =>
          '<td' + (key === 'overdue' && row.counts[key] ? ' class="critical-text"' : '') + '>' +
          formatCount(row.counts[key]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' +
        '<details class="executive-definitions"><summary>How to read the dealer table</summary>' +
        '<p>Every column uses the same leads and their current assigned contact. Assigned includes closed leads. ' +
        'Open counts leads with the PH workflow on in New, Central Review or With Dealer. Opportunities use the same open population.</p>' +
        '<p>First update counts leads with a recorded timestamp. Waiting for first update excludes leads with other recorded dealer progress, ' +
        'leads in Central Review and leads flagged for sale checks. Activity in period counts leads with a first update or ' +
        'latest follow-up recorded during the reporting period. Each lead counts once, under its current assigned contact.</p>' +
        '<p>Follow-ups cover open leads marked Interested or Follow-up Needed outside Central Review and sale checks. ' +
        'Past due and No follow-up date are subsets of this group. Sold stage is the current CRM label.</p></details>' :
        '<p class="empty">No leads with an assigned dealer contact match these filters.</p>');
  }

  private renderStages(report: ExecutiveReport) {
    const distribution = (title: string, stages: ExecutiveReport['salesStages']) =>
      '<div><h3>' + title + '</h3><dl class="executive-distribution">' + stages.map(({ label, count }) =>
        '<div><dt>' + escape(label) + '</dt><dd>' + formatCount(count) +
        '<span class="distribution-track" aria-hidden="true"><span style="--share:' +
        count / report.totals.leads * 100 + '%"></span></span></dd></div>').join('') + '</dl></div>';
    byId('exec-stages').innerHTML =
      '<header class="section-head"><h2>Where leads stand now</h2><p>Current CRM classifications across all lead dates.</p></header>' +
      '<div class="stage-groups">' + distribution('Sales stage', report.salesStages) +
      distribution('Work status', report.workflowStages) + '</div>' +
      '<p class="executive-context">Sold, Not Sold and Lost are recorded sales stages. Sale verification is tracked separately.</p>';
  }

  private renderActivity(activity: ExecutiveReport['activity']) {
    const rows = activity.buckets.map(bucket => [range(bucket.start, bucket.end), formatCount(bucket.created), formatCount(bucket.updates)]);
    byId('exec-trend-heading').innerHTML =
      '<header class="section-head"><h2>New leads and dealer update activity</h2>' +
      '<p>' + range(activity.start, activity.asOf) + ' compared with ' + range(activity.previousStart, activity.previousEnd) +
      ', through the same Manila time of day.</p></header>' +
      '<div class="table-scroll" tabindex="0" role="region" aria-label="Activity period comparison"><table>' +
      '<thead><tr><th scope="col">Activity</th><th scope="col">Selected period</th><th scope="col">Prior period</th></tr></thead>' +
      '<tbody><tr><th scope="row">New leads</th><td>' + formatCount(activity.current.created) +
      '</td><td>' + formatCount(activity.previous.created) + '</td></tr><tr><th scope="row">First updates</th><td>' +
      formatCount(activity.current.updates) + '</td><td>' + formatCount(activity.previous.updates) + '</td></tr></tbody></table></div>';
    const hasActivity = activity.current.created > 0 || activity.current.updates > 0;
    byId('exec-chart').hidden = !hasActivity;
    if (hasActivity) {
      this.trend.render(activity.buckets.map(bucket => ({ label: range(bucket.start, bucket.end),
        created: bucket.created, updates: bucket.updates })), activity.buckets.some(bucket => bucket.start !== bucket.end));
    }
    byId('exec-trend-table').innerHTML =
      (hasActivity ?
        '<details class="executive-definitions"><summary>Activity by date</summary>' +
        table('Activity by date', ['Manila dates', 'New leads', 'First updates'], rows) + '</details>' :
        '<p class="empty">No new leads or first updates in the selected period.</p>') +
      '<p class="executive-context">New leads use the date added to CRM. First updates use the recorded update date and can include older leads.</p>';
  }
}
