import { manilaDay } from '../data/manila.js';
import type { Desk, Handoff, IssueKind, Lead, OverviewMetric, Report } from '../data/dashboard.js';
import { ActivityChart } from './activity-chart.js';
import { byId, escape, table, when } from './common.js';
const leadDate = new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric',
});
const trendDate = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });

const deskLabels: Record<Desk, string> = {
  intake: 'Lead review & assignment', contact: 'Dealer contact', verification: 'Sale checks',
};
const issues: Record<IssueKind, [string, string]> = {
  'central-review': ['Waiting for Central CRM', 'Review the lead and confirm what should happen next.'],
  unassigned: ['No dealer assigned', 'Check the lead’s area and find the right dealer.'],
  'first-update': ['Awaiting first dealer update', 'Ask the assigned dealer to confirm first contact and record the update in CRM.'],
  'follow-up': ['Follow-up due', 'Review the next action and confirm the follow-up with the assigned dealer.'],
  'missing-follow-up': ['Interested, no follow-up date', 'Confirm what the dealer should do next and when.'],
  verification: ['Sale needs checking', 'Check the sale report using the Central CRM process.'],
  attention: ['Needs attention', 'Check the reason and confirm who should act.'],
  unmapped: ['Work status needs checking', 'Confirm whether the lead is still open or already closed.'],
};
const reasonLabels = new Map([
  ['First Contact Overdue', 'First contact is overdue'],
  ['Follow-up Overdue', 'Follow-up is overdue'],
  ['Assistance Needed', 'Needs help'],
  ['Invalid Contact', 'Invalid contact details'],
  ['Sale Verification', 'Sale needs checking'],
  ['Unmapped reason', 'Reason needs checking'],
]);
const reasonLabel = (value: string | null) => reasonLabels.get(value ?? '') ?? (value?.trim() || 'Reason not recorded');
const leadName = (lead: Lead) => lead.name ?? 'Name unavailable';
const searchText = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');

type IssueFilter = '' | IssueKind | 'overdue' | 'due-today';
type Sort = 'priority' | 'deadline' | 'owner';
type OpenLead = (leadId: string) => Promise<boolean>;
const metrics: Record<OverviewMetric, [string, string]> = {
  newLeads: ['New Central CRM leads', 'Leads added to CRM during the selected dates, using Manila time.'],
  opportunities: ['Active opportunities', 'Leads marked Opportunity with the PH workflow on and a work status of New, Central Review or With Dealer.'],
  unassigned: ['Awaiting assignment', 'Active leads without an assigned PH dealer contact.'],
  awaitingFirst: ['Waiting for first dealer update', 'Assigned leads still waiting for the dealer to record a first update, follow-up or customer contact. This leaves out leads with Central CRM for review or sale checks.'],
};
const pageSize = 2;

function title(row: Handoff, asOf: number) {
  if (row.kinds[0] === 'first-update' && row.deadline !== null && row.deadline < asOf) {
    return row.deadline === row.lead.firstDue ? 'First dealer update overdue' : 'Scheduled action overdue';
  }
  if (row.kinds[0] === 'follow-up' && row.deadline !== null && row.deadline < asOf) return 'Follow-up overdue';
  return issues[row.kinds[0]][0];
}

function owner(row: Handoff) {
  return row.lead.dealer?.name ?? 'Central CRM · unassigned';
}

function leadButton(lead: Lead) {
  return '<button type="button" class="review" data-record="' + escape(lead.id) + '" aria-label="Review ' + escape(leadName(lead)) + '">Review</button>';
}

function card(row: Handoff, asOf: number) {
  const priority = row.critical ? 'Critical' : 'Review';
  const status = row.deadline !== null && row.deadline < asOf ? ' · Past due' : '';
  const issue = title(row, asOf);
  const reason = row.lead.attention ? reasonLabel(row.lead.reason) : '';
  const additional = row.kinds.slice(1).filter(kind => kind !== 'attention').map(kind => issues[kind][0]).join(' · ');
  return '<li><div class="lane-card-top"><strong class="lead-name">' + escape(leadName(row.lead)) +
    '</strong><span class="priority ' + (row.critical ? 'critical' : '') + '">' + priority + '</span></div>' +
    '<strong>' + issue + '</strong><dl class="lane-record"><dt>Assigned to</dt><dd>' + escape(owner(row)) +
    '</dd><dt>Due</dt><dd>' + escape(when(row.deadline)) + status + '</dd></dl>' +
    (additional ? '<small class="lane-extra">' + escape(additional) + '</small>' : '') +
    (reason && reason !== issue ? '<small class="lane-extra">Why it needs attention: ' + escape(reason) + '</small>' : '') +
    '<p class="lane-action">' + issues[row.kinds[0]][1] + '</p>' + leadButton(row.lead) + '</li>';
}

function heading(title: string, note: string) {
  return '<header class="section-head"><h2>' + escape(title) + '</h2><p>' + escape(note) + '</p></header>';
}

export class Board {
  private report?: Report;
  private asOf = 0;
  private leads = new Map<string, Lead>();
  private issue: IssueFilter = '';
  private attentionReason?: { key: string; label: string };
  private critical = false;
  private sort: Sort = 'priority';
  private pages: Record<Desk, number> = { intake: 0, contact: 0, verification: 0 };
  private openLead?: OpenLead;
  private readonly search = byId<HTMLInputElement>('lead-search');
  private readonly issueSelect = byId<HTMLSelectElement>('issue');
  private readonly trend = new ActivityChart(byId('daily-chart'));

  constructor() {
    const options: [IssueFilter, string][] = [['', 'All issues'], ['overdue', 'Overdue actions'], ['due-today', 'Due later today'],
      ...(Object.keys(issues) as IssueKind[]).map((key): [IssueFilter, string] => [key, issues[key][0]])];
    this.issueSelect.replaceChildren(...options.map(([key, label]) => new Option(label, key)));
    byId('content').addEventListener('click', event => this.click(event));
    this.search.addEventListener('input', () => {
      this.resetPages();
      this.renderQueue();
    });
    byId('queue').addEventListener('change', event => {
      const control = event.target;
      if (!(control instanceof HTMLSelectElement)) return;
      if (control.id === 'issue') {
        this.issue = control.value as IssueFilter;
        this.attentionReason = undefined;
      }
      if (control.id === 'task-sort') this.sort = control.value as Sort;
      this.resetPages();
      this.renderQueue();
    });
    byId('detail-body').addEventListener('click', event => this.click(event));
  }

  render(report: Report, asOf: number, leads: readonly Lead[], openLead?: OpenLead) {
    this.report = report;
    this.asOf = asOf;
    this.leads = new Map(leads.map(lead => [lead.id, lead]));
    this.openLead = openLead;
    this.resetPages();
    byId('metrics').innerHTML = '<div class="metric-grid">' + (Object.keys(metrics) as OverviewMetric[]).map(key => {
      const [label] = metrics[key];
      const notes: Record<OverviewMetric, string> = {
        newLeads: report.metrics.total + ' in this view across all dates',
        opportunities: 'At the Opportunity stage',
        unassigned: 'Across all dates',
        awaitingFirst: 'Dealer assigned',
      };
      return '<button type="button" class="metric" data-metric="' + key + '"><span class="metric-name">' + label +
        '</span><strong>' + report.metrics[key] + '</strong><span class="metric-note">' + notes[key] +
        '</span><span class="metric-link">View leads</span></button>';
    }).join('') + '</div>';

    const totals = report.metrics;
    const alerts: [IssueFilter | 'interested', string, number][] = [
      ['central-review', issues['central-review'][0], totals.centralReview],
      ['overdue', 'Overdue actions', totals.overdue], ['due-today', 'Due later today', totals.dueToday],
      ['interested', 'Open leads marked interested', totals.interested],
      ['missing-follow-up', 'Interested without a follow-up date', totals.missingFollowUp],
      ['attention', issues.attention[0], totals.attention], ['unmapped', issues.unmapped[0], totals.unmapped],
      ['verification', issues.verification[0], totals.verification],
    ];
    byId('attention').innerHTML = heading('Issues to check', 'A lead can appear under more than one issue.') +
      '<ul class="attention-list">' + alerts.map(([key, label, count]) => {
        const visual = '<span>' + label + '</span><strong>' + count + '</strong>';
        const action = key === 'interested' ? 'data-interested' : 'data-alert="' + key + '"';
        return '<li><button type="button" ' + action + (count ? '' : ' disabled') + '>' + visual + '</button></li>';
      }).join('') + '</ul>';

    byId('analysis').innerHTML = heading('Dealer follow-up', totals.assigned + ' assigned · ' + totals.unassigned +
      ' unassigned among open leads with the PH workflow on.') +
      (report.dealers.length ? table('Dealer follow-up table', ['Dealer contact', 'Assigned leads', 'Waiting for update', 'First update recorded', 'Follow-up recorded', 'Overdue'],
        report.dealers.map(row => [
          row.dealer.name, String(row.assigned), String(row.awaiting), String(row.updated),
          String(row.followedUp), String(row.overdue),
        ])) : '<p class="empty">No dealer assignments match these filters.</p>') +
      '<p class="queue-notice">Counts are grouped by the dealer currently assigned. A lead can have both a first update and a follow-up.</p>' +
      '<details class="chart-data"><summary>Recorded lead stages</summary><p class="queue-notice">Includes leads from all dates in this CRM view. Sold is the stage recorded in CRM.</p>' +
      table('Recorded lead stages', ['CRM lead stage', 'Leads'], report.salesStages.map(row => [row.label, String(row.count)])) +
      '</details>';

    byId('attention-triage').innerHTML = heading('Why leads need attention',
      totals.attention + (totals.attention === 1 ? ' lead needs' : ' leads need') + ' attention across all dates.') +
      (report.attentionGroups.length
        ? '<table class="triage-table" aria-label="Flagged leads by CRM reason"><thead><tr>' +
          '<th scope="col">Reason</th><th scope="col">Leads</th><th scope="col">Past due</th><th scope="col">Oldest lead</th>' +
          '</tr></thead><tbody>' + report.attentionGroups.map(group =>
            '<tr><th scope="row"><button type="button" data-reason="' + escape(group.key) + '">' + escape(reasonLabel(group.label)) + '</button></th>' +
            '<td>' + group.count + '</td><td' + (group.overdue ? ' class="critical-text"' : '') + '>' + group.overdue +
            '</td><td>' + leadDate.format(group.oldestCreated) + '</td></tr>').join('') + '</tbody></table>' +
          '<p class="triage-note">Select a reason to see its leads. Past due uses the due date in the work queue. Oldest lead shows when it was added to CRM.</p>'
        : '<p class="empty">No leads need attention with these filters.</p>');

    const dates = report.activity.length > 7 ? report.activity.slice(-7) : report.activity;
    byId('daily-trend-heading').innerHTML = heading('New leads and first dealer updates',
      report.activity.length > 7 ? 'The chart shows the last 7 days. See daily counts for all selected dates.' : 'First updates can include leads added before these dates.');
    this.trend.render(dates.map(day => ({ label: trendDate.format(Date.parse(day.date + 'T00:00:00+08:00')),
      created: day.created, updates: day.firstUpdates })));
    byId('daily-trend-table').innerHTML = '<details class="chart-data"><summary>Daily counts</summary>' +
      table('Daily counts in Manila time', ['Date', 'New leads', 'First updates'],
        report.activity.map(day => [day.date, String(day.created), String(day.firstUpdates)])) + '</details>';
    this.renderQueue();
  }

  private resetPages() {
    this.pages = { intake: 0, contact: 0, verification: 0 };
  }

  private renderQueue(focus?: string, alternate?: string) {
    if (!this.report) return;
    const search = searchText(this.search.value);
    const deadline = (item: Handoff) => item.deadline ?? Infinity;
    const priorityOrder = (a: Handoff, b: Handoff) =>
      Number(b.critical) - Number(a.critical) || deadline(a) - deadline(b) || a.lead.created - b.lead.created;
    const rows = this.report.queue.filter(row => {
      if (this.critical && !row.critical) return false;
      if (this.attentionReason && row.attentionGroup !== this.attentionReason.key) return false;
      if (search && (!row.lead.name || !searchText(row.lead.name).includes(search))) return false;
      switch (this.issue) {
        case 'overdue': return row.deadline !== null && row.deadline < this.asOf;
        case 'due-today':
          return row.deadline !== null && row.deadline >= this.asOf && manilaDay(row.deadline) === manilaDay(this.asOf);
        case '': return true;
        default: return row.kinds.includes(this.issue);
      }
    }).sort((a, b) => {
      if (this.sort === 'owner') return owner(a).localeCompare(owner(b)) || priorityOrder(a, b);
      if (this.sort === 'deadline') return deadline(a) - deadline(b) || priorityOrder(a, b);
      return priorityOrder(a, b);
    });

    this.issueSelect.value = this.issue;
    byId('critical-only').setAttribute('aria-pressed', String(this.critical));
    byId('match-count').textContent = rows.length + (rows.length === 1 ? ' matching lead' : ' matching leads');
    byId('queue-scope').hidden = !this.attentionReason;
    byId('queue-reason').textContent = this.attentionReason ? reasonLabel(this.attentionReason.label) : '';

    const lanes = (Object.keys(deskLabels) as Desk[]).map(desk => {
      const label = deskLabels[desk];
      const matching = rows.filter(row => row.desk === desk);
      const from = this.pages[desk] * pageSize;
      const visible = matching.slice(from, from + pageSize);
      const critical = matching.filter(row => row.critical).length;
      const pageButton = (step: number, word: string, disabled: boolean) =>
        '<button type="button" data-desk="' + desk + '" data-step="' + step + '" aria-label="' + word + ' leads for ' + escape(label) + '"' +
        (disabled ? ' disabled' : '') + '>' + word + '</button>';
      const pager = matching.length > pageSize ? '<div class="pagination lane-pager"><span role="status">' +
        (from + 1) + '–' + (from + visible.length) + ' of ' + matching.length + '</span>' +
        pageButton(-1, 'Previous', from === 0) + pageButton(1, 'Next', from + pageSize >= matching.length) + '</div>' : '';
      const filtered = search || this.issue || this.critical;
      const empty = filtered ? 'No leads in this lane match your filters.' :
        desk === 'verification' ? 'No leads waiting for a sale check.' : 'No leads waiting here.';
      const content = visible.length ? '<ul>' + visible.map(row => card(row, this.asOf)).join('') + '</ul>' + pager :
        '<p class="lane-empty">' + empty + '</p>';
      return '<section aria-labelledby="desk-' + desk + '"><header class="lane-head"><h3 id="desk-' + desk + '">' + escape(label) +
        '</h3><span>' + matching.length + (matching.length === 1 ? ' lead' : ' leads') +
          (critical ? ' · <strong class="critical-text">' + critical + ' critical</strong>' : '') + '</span></header>' + content + '</section>';
    }).join('');
    byId('lanes').innerHTML = lanes;
    if (focus) {
      const target = document.querySelector<HTMLElement>(focus);
      if (target && !target.matches(':disabled')) target.focus();
      else if (alternate) document.querySelector<HTMLElement>(alternate)?.focus();
    }
  }

  private click(event: MouseEvent) {
    if (!(event.target instanceof Element) || !this.report) return;
    const button = event.target.closest<HTMLButtonElement>('button');
    if (!button) return;
    const { metric, record, desk, step, alert, open, reason } = button.dataset;
    if (metric) {
      const key = metric as OverviewMetric;
      const [label, definition] = metrics[key];
      this.showRecords(label, definition, this.report.overview[key]);
    } else if (record) {
      const lead = this.leads.get(record);
      if (lead) this.review(lead);
    } else if (alert || reason) {
      this.issue = reason ? 'attention' : alert as IssueFilter;
      this.attentionReason = this.report.attentionGroups.find(group => group.key === reason);
      this.critical = false;
      this.search.value = '';
      this.resetPages();
      location.hash = 'queue';
      this.renderQueue('#issue');
      byId('queue').scrollIntoView({ block: 'start' });
    } else if (button.hasAttribute('data-interested')) {
      this.showRecords('Open leads marked interested',
        'Open leads marked Contacted - Interested with the PH workflow on. This includes leads whose next action is due later.',
        this.report.interestedLeads);
    } else if (button.id === 'clear-reason') {
      this.attentionReason = undefined;
      this.resetPages();
      this.renderQueue('#issue');
    } else if (button.id === 'critical-only') {
      this.critical = !this.critical;
      this.resetPages();
      this.renderQueue('#critical-only');
    } else if (desk && step) {
      this.pages[desk as Desk] += Number(step);
      const prefix = '[data-desk="' + desk + '"]';
      this.renderQueue(prefix + '[data-step="' + step + '"]', prefix + '[data-step="' + -Number(step) + '"]');
    } else if (open && this.openLead) {
      button.disabled = true;
      const status = byId('record-status');
      void this.openLead(open).then(result => {
        status.textContent = result ? 'Lead opened in CRM.' : 'CRM could not open this Lead.';
      }, () => { status.textContent = 'CRM could not open this Lead.'; })
        .finally(() => { button.disabled = false; });
    }
  }

  private showRecords(title: string, note: string, leads: readonly Lead[]) {
    const rows = leads.slice(0, 200);
    const body = rows.map(lead => '<li><span class="lead-name">' + escape(leadName(lead)) + '</span>' + leadButton(lead) + '</li>').join('');
    this.show(title, '<p>' + escape(note) + '</p><p><strong>' + leads.length + (leads.length === 1 ? ' matching lead' : ' matching leads') + '</strong>' +
      (rows.length < leads.length ? ' · First 200 shown. Use the approved CRM view for the full list.' : '') +
      '</p>' + (rows.length ? '<ul class="record-list">' + body + '</ul>' : '<p>No leads match these filters.</p>'));
  }

  private review(lead: Lead) {
    const row = this.report?.queue.find(item => item.lead.id === lead.id);
    const details: [string, string][] = [
      ['Assigned dealer contact', lead.dealer?.name ?? 'Unassigned'], ['Added to CRM', when(lead.created)],
      ['Sales stage', lead.stage ?? 'Not recorded'], ['Work status', lead.workflow ?? 'Not recorded'],
      ['Latest outcome', lead.outcome ?? 'Not recorded'], ['First dealer update', lead.firstUpdate === null ? 'Not recorded' : when(lead.firstUpdate)],
      ['First contact due', when(lead.firstDue)], ['Next action due', when(lead.nextDue)],
      ['Last follow-up', lead.lastFollowUp === null ? 'Not recorded' : when(lead.lastFollowUp)],
    ];
    if (row) details.push(['Due date used here', row.deadline === null ? 'No due date for this task' : when(row.deadline)]);
    if (lead.attention) details.push(['Why it needs attention', reasonLabel(lead.reason)]);
    this.show(leadName(lead),
      (row ? '<p><strong>' + escape(title(row, this.asOf)) + '</strong></p>' : '') +
      '<dl class="detail-fields">' + details.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + escape(value) + '</dd></div>').join('') + '</dl>' +
      (row ? '<h3>Next action</h3><p>' + issues[row.kinds[0]][1] + '</p>' : '') +
      (this.openLead ? '<button class="review" type="button" data-open="' + escape(lead.id) + '">Open Lead in CRM</button><p id="record-status" role="status"></p>' : ''));
  }

  private show(title: string, content: string) {
    byId('detail-title').textContent = title;
    byId('detail-body').innerHTML = content;
    const dialog = byId<HTMLDialogElement>('detail');
    if (!dialog.open) dialog.showModal();
    else dialog.querySelector('button')?.focus();
  }
}
