import type { DashboardSnapshot, QueueIssue } from '../data/dashboard.js';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

export function byId(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error('Missing dashboard element ' + id);
  return node;
}

const manila = 'Asia/Manila';
const dateFormat = new Intl.DateTimeFormat('en-PH', { timeZone: manila, month: 'short', day: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('en-PH', {
  timeZone: manila, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function time(value: string, format: Intl.DateTimeFormat): HTMLTimeElement {
  const node = element('time', format.format(new Date(value)));
  node.dateTime = value;
  return node;
}

function queueRow(issue: QueueIssue): HTMLTableRowElement {
  const row = element('tr');
  const priority = element('span', issue.priority);
  priority.className = 'tag';
  if (issue.priority === 'Critical') priority.dataset.tone = 'critical';
  if (issue.priority === 'High') priority.dataset.tone = 'warning';

  const record = element('td');
  const id = element('span', issue.id);
  id.className = 'record-id';
  record.append(id, element('strong', issue.issue));

  const deadline = element('td');
  deadline.append(time(issue.deadline, dateTimeFormat), ' PHT');

  const review = element('button', 'Review');
  review.setAttribute('aria-label', 'Review ' + issue.id);
  review.addEventListener('click', () => {
    byId('review-title').textContent = issue.id + ' · ' + issue.issue;
    byId('review-body').textContent = issue.nextAction;
    document.querySelector('dialog')?.showModal();
  });

  const priorityCell = element('td');
  priorityCell.append(priority);
  const action = element('td');
  action.append(review);
  row.append(priorityCell, record, element('td', issue.owner), deadline, element('td', issue.status), action);
  return row;
}

function summary(label: string | HTMLElement, value: number): HTMLLIElement {
  const row = element('li');
  row.append(label, element('strong', String(value)));
  return row;
}

export function renderDashboard(snapshot: DashboardSnapshot): void {
  const { metrics, queue } = snapshot;
  const overview: [string, number][] = [
    ['New Leads', metrics.newLeads],
    ['Unassigned Leads', metrics.unassigned],
    ['Overdue Follow-ups', metrics.overdue],
    ['Pending Sale Verification', metrics.pendingVerification],
  ];
  byId('metrics').replaceChildren(...overview.map(([label, count]) => {
    const item = element('div');
    item.append(element('dt', label), element('dd', String(count)));
    return item;
  }));

  byId('period').textContent = snapshot.period;
  byId('updated').replaceChildren(time(snapshot.updatedAt, dateTimeFormat), ' PHT');
  byId('queue-count').textContent = queue.length + (queue.length === 1 ? ' issue' : ' issues');
  byId('queue').replaceChildren(...queue.map(queueRow));
  byId('queue-scroll').hidden = queue.length === 0;
  byId('queue-empty').hidden = queue.length > 0;

  byId('activity').replaceChildren(...(snapshot.activity.length
    ? snapshot.activity.map(day => summary(time(day.date, dateFormat), day.leads))
    : [element('li', 'No lead activity in this period.')]));
  byId('exceptions').replaceChildren(
    summary('Follow-ups past deadline', metrics.overdue),
    summary('Leads missing a dealer', metrics.unassigned),
    summary('Sales awaiting verification', metrics.pendingVerification),
  );
}
