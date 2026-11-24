(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const concept = document.body.className;
  const controls = ['period', 'source', 'product', 'territory'].map($);
  const slots = ['metrics', 'attention', 'queue', 'trend', 'analysis', 'mix'];
  const defaultIssue = concept === 'verification-desk' ? 'sales' : '';
  const state = { view: 'ops', issue: defaultIssue, sort: 'priority', direction: 1, page: 0 };
  const board = { criticalOnly: false, deskPages: [0, 0, 0] };
  const pageSize = 5;
  const lanePageSize = 2;
  const pct = (num, den) => den ? `${Math.round(num * 100 / den)}%` : '—';
  const change = (now, prior) => `${now - prior > 0 ? '+' : ''}${now - prior} vs prior week`;
  const escape = value => String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const panel = (title, note, content) => `<header class="section-head"><h2>${title}</h2>${note ? `<p>${note}</p>` : ''}</header>${content}`;
  const empty = text => `<p class="empty">${text}</p>`;
  const kindLabel = { contact: 'First contact', assignment: 'Assignment', follow: 'Follow-up', evidence: 'Sale evidence', sale: 'Verification', quality: 'Intake quality' };
  const value = (label, key, rows, note, definition, display = rows.length) => ({ label, key, rows, note, definition, display });
  let data;
  let metrics = [];
  let activePeriod;

  function getMetrics(current, previous) {
    const { cohort, eligible, assigned, contacted, verified, pending, waiting, queue, onTime, slaDue } = current;
    const follow = queue.filter(row => ['contact', 'follow'].includes(row.kind));
    const missingEvidence = pending.filter(row => !row.evidence);
    const missed = slaDue.filter(row => !onTime.includes(row));
    const rate = value('First-contact SLA', 'sla', slaDue, `${onTime.length} on time · ${missed.length} missed`,
      'Numerator: assigned leads contacted within 24 hours of assignment. Denominator: assigned leads whose sample 24-hour deadline elapsed before period close. The drill-down contains the denominator.', pct(onTime.length, slaDue.length));
    const conversion = value('Verified conversion', 'conversion', eligible, `${verified.length} verified / ${eligible.length} eligible`,
      'Verified sales divided by eligible leads received in the selected week, with outcomes observed through that week’s close. The drill-down contains the denominator. Recent cohorts can still be maturing.', pct(verified.length, eligible.length));
    const standard = {
      intake: value('Eligible leads', 'intake', eligible, change(eligible.length, previous?.eligible.length ?? eligible.length),
        'Synthetic leads received within the selected period and marked eligible. The comparison uses the previous seven-day cohort and the same filters.'),
      assigned: value('Awaiting assignment', 'assignment', waiting, `${queue.filter(row => row.kind === 'assignment').length} past sample deadline`,
        'Eligible leads from this cohort with no dealer assignment by period close. The demo flags those waiting more than 24 hours.'),
      follow: value('Contact / follow-up overdue', 'follow', follow, `${follow.filter(row => row.kind === 'contact').length} first contacts overdue`,
        'Assigned leads with an elapsed first-contact deadline and no contact, or contacted leads with an unresolved follow-up deadline.'),
      sales: value('Sales awaiting verification', 'pending', pending, `${missingEvidence.length} missing evidence`,
        'Dealer-reported sales in the selected intake cohort with no verification recorded before period close.'),
      evidence: value('Missing evidence', 'evidence', missingEvidence, 'Pending reports that need dealer input',
        'Reported sales awaiting verification whose sample evidence is incomplete.'),
      aged: value('Reports pending 2+ days', 'aged', pending.filter(row => activePeriod.end - row.reported >= 2), 'At the selected period close',
        'Pending reports at least 48 hours old at the selected period close.'),
      sla: rate, conversion,
      verified: value('Verified sales', 'verified', verified, change(verified.length, previous?.verified.length ?? verified.length),
        'Dealer-reported sales from the selected intake cohort verified before period close.'),
      contacted: value('Customers contacted', 'contacted', contacted, `${contacted.length} of ${assigned.length} assigned`,
        'Leads with a first contact recorded by period close. The denominator in the context label is assigned leads in the same cohort.'),
      received: value('Lead submissions', 'received', cohort, `${cohort.length - eligible.length} outside eligible cohort`,
        'All synthetic Philippine submissions received in the selected period, including ineligible records.'),
    };
    const order = state.view === 'exec'
      ? ({
        'intake-exchange': ['received', 'intake', 'conversion', 'contacted'],
        'handoff-board': ['sla', 'contacted', 'verified', 'conversion'],
        'cohort-ledger': ['received', 'conversion', 'verified', 'sla'],
        'territory-atlas': ['contacted', 'sla', 'verified', 'conversion'],
        'verification-desk': ['verified', 'conversion', 'sales', 'evidence'],
      }[concept] || ['conversion', 'verified', 'contacted', 'sla'])
      : ({
        'intake-exchange': ['received', 'intake', 'assigned', 'follow'],
        'handoff-board': ['assigned', 'follow', 'sales', 'sla'],
        'cohort-ledger': ['intake', 'sla', 'conversion', 'verified'],
        'territory-atlas': ['assigned', 'follow', 'contacted', 'sla'],
        'verification-desk': ['sales', 'evidence', 'aged', 'verified'],
        'shift-huddle': ['assigned', 'follow', 'sales', 'intake'],
      }[concept]);
    return order.map(key => standard[key]);
  }

  function renderMetrics() {
    $('metrics').innerHTML = `<div class="metric-grid">${metrics.map(metric => `<button type="button" class="metric" data-metric="${metric.key}" aria-label="${escape(metric.label)}: ${metric.display}. View definition and records"><span class="metric-name">${metric.label}</span><strong>${metric.display}</strong><span class="metric-note">${escape(metric.note)}</span><span class="metric-link" aria-hidden="true">View records ↗</span></button>`).join('')}</div>`;
  }

  function renderAttention() {
    if (concept === 'verification-desk') {
      const ranges = [[0, 1, 'Under 24 hours'], [1, 2, '24–48 hours'], [2, Infinity, '48 hours or more']];
      $('attention').innerHTML = panel('Age of pending reports', 'Time since the dealer reported the sale.',
        `<ul class="attention-list">${ranges.map(([min, max, label], index) => {
          const rows = data.pending.filter(row => activePeriod.end - row.reported >= min && activePeriod.end - row.reported < max);
          return `<li><button type="button" data-age="${index}"><span>${label}</span><strong>${rows.length}</strong></button></li>`;
        }).join('')}</ul>`);
      return;
    }
    if (concept === 'shift-huddle') {
      const seen = new Set();
      const briefing = data.queue.filter(row => {
        const desk = desks.find(([, kinds]) => kinds.includes(row.kind))[0];
        if (seen.has(desk)) return false;
        seen.add(desk);
        return true;
      });
      $('attention').innerHTML = panel('Start here', 'The first issue to review at each desk.',
        briefing.length ? `<ol class="brief-actions">${briefing.map(row => `<li><button type="button" data-record="${row.id}"><span>${priority(row)}</span><strong>${row.title}</strong><small>${escape(row.owner)} · ${dueLabel(row)}</small></button></li>`).join('')}</ol>` : empty('No issues to bring to the huddle.'));
      return;
    }
    const ranked = Object.keys(kindLabel).map(kind => ({
      kind, count: data.queue.filter(row => row.kind === kind).length,
      critical: data.queue.filter(row => row.kind === kind && row.critical).length,
    })).filter(row => row.count).sort((a, b) => b.critical - a.critical || b.count - a.count);
    const critical = data.queue.filter(row => row.critical).length;
    const detail = critical ? `${critical} critical ${critical === 1 ? 'exception' : 'exceptions'} at period close` : 'No critical exceptions in this selection';
    $('attention').innerHTML = panel(state.view === 'exec' ? 'Management attention' : 'Operational exceptions', detail,
      ranked.length ? `<ul class="attention-list">${ranked.slice(0, 4).map(row => `<li><button type="button" data-kind="${row.kind}"><span>${kindLabel[row.kind]}${row.critical ? `<small>${row.critical} critical</small>` : ''}</span><strong class="${row.critical ? 'critical-text' : ''}">${row.count}</strong></button></li>`).join('')}</ul>` : empty('No operational exceptions to review.'));
  }

  function chartColumns(rows, maximum) {
    return `<div class="columns">${rows.map(row => `<div class="column"><div class="column-pair"><span class="intake-bar" style="--height:${row.intake / maximum * 100}%"></span><span class="contact-bar" style="--height:${row.contacts / maximum * 100}%"></span></div><span>${row.label.split(' ').at(-1)}</span></div>`).join('')}</div>`;
  }

  function chartLines(rows, maximum) {
    const x = index => 24 + index * (512 / (rows.length - 1));
    const y = number => 120 - number / maximum * 100;
    return `<svg class="line-chart" viewBox="0 0 560 145" role="img" aria-label="Eligible intake and first contacts by day">
      ${[20, 70, 120].map((line, index) => `<path class="chart-grid" d="M24 ${line}H536"/><text x="0" y="${line + 4}">${Math.round(maximum * (1 - index / 2))}</text>`).join('')}
      ${['intake', 'contacts'].map(key => `<polyline class="line-${key}" points="${rows.map((row, index) => `${x(index)},${y(row[key])}`).join(' ')}"/>${rows.map((row, index) => `<circle class="point-${key}" cx="${x(index)}" cy="${y(row[key])}" r="3"><title>${row.label}: ${row[key]} ${key}</title></circle>`).join('')}`).join('')}
      ${rows.map((row, index) => `<text x="${x(index)}" y="140" text-anchor="middle">${row.label}</text>`).join('')}</svg>`;
  }

  function renderTrend() {
    const rows = data.trend;
    const maximum = Math.ceil(Math.max(5, ...rows.flatMap(row => [row.intake, row.contacts])) / 5) * 5;
    const gap = data.eligible.length - data.contacted.length;
    if (concept === 'verification-desk') {
      const salesRows = rows.map(row => ({ label: row.label, intake: row.reported, contacts: row.verified }));
      const salesMax = Math.max(4, ...salesRows.flatMap(row => [row.intake, row.contacts]));
      const reported = salesRows.reduce((sum, row) => sum + row.intake, 0);
      $('trend').innerHTML = panel('Evidence workload', `${reported} reported · ${data.verified.length} verified by close`,
        data.cohort.length ? `<div class="chart">${chartColumns(salesRows, salesMax)}<div class="legend"><span>Dealer reports</span><span>Verified sales</span></div></div><details class="chart-data"><summary>Daily values</summary>${simpleTable(['Manila day', 'Reports', 'Verified'], salesRows.map(row => [row.label, row.intake, row.contacts]))}</details>` : empty('No records for this selection.'));
      return;
    }
    const chart = ['territory-atlas', 'verification-desk'].includes(concept) ? chartLines(rows, maximum)
      : ['cohort-ledger', 'shift-huddle'].includes(concept)
      ? `<div class="flow-list" aria-hidden="true">${rows.map(row => `<div><span>${row.label}</span><span class="pair-track"><i style="--width:${row.intake / maximum * 100}%"></i><i style="--width:${row.contacts / maximum * 100}%"></i></span><strong>${row.intake} / ${row.contacts}</strong></div>`).join('')}</div>`
      : chartColumns(rows, maximum);
    $('trend').innerHTML = panel('Intake and first contact',
      `${gap} eligible leads had no first contact by close.`,
      data.cohort.length ? `<div class="chart">${chart}<div class="legend"><span>Eligible intake · ${data.eligible.length}</span><span>First contacts · ${data.contacted.length}</span></div></div><details class="chart-data"><summary>Daily values</summary>${simpleTable(['Manila day', 'Eligible intake', 'First contacts'], rows.map(row => [row.label, row.intake, row.contacts]))}</details>` : empty('No lead activity for these filters.'));
  }

  function simpleTable(headers, rows) {
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(headers[0])} table"><table><thead><tr>${headers.map(name => `<th scope="col">${escape(name)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map((cell, index) => index ? `<td>${escape(cell)}</td>` : `<th scope="row">${escape(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  function renderAnalysis() {
    const funnel = [['Received', data.cohort], ['Eligible', data.eligible], ['Assigned', data.assigned], ['Contacted', data.contacted], ['Verified', data.verified]];
    const dealerRows = [...data.dealers].sort((a, b) => b.aging - a.aging || b.waiting - a.waiting);
    const dealerTable = simpleTable(['Territory', 'Assigned', 'Contact rate', 'Aged 2d+', 'Unassigned', 'Verified'],
      dealerRows.map(row => [row.label, row.assigned, `${row.contacted}/${row.assigned} · ${pct(row.contacted, row.assigned)}`, row.aging, row.waiting, row.verified]));
    const funnelChart = `<ol class="funnel">${funnel.map(([label, rows], index) => `<li><button type="button" data-funnel="${index}"><span>${label}</span><span class="funnel-track"><i style="--width:${data.cohort.length ? rows.length / data.cohort.length * 100 : 0}%"></i></span><strong>${rows.length}</strong></button></li>`).join('')}</ol>`;
    const funnelTitle = `<h3>Sales funnel</h3><p class="context">One intake cohort, measured at week close.</p>`;
    const dealerTitle = `<h3>Dealer execution</h3><p class="context">Contact rate uses assigned leads. Aged leads are still uncontacted two or more days after assignment.</p>`;
    if (concept === 'cohort-ledger') {
      const statement = `<ol class="stage-statement">${funnel.map(([label, rows], index) => {
        const prior = funnel[index - 1]?.[1].length;
        return `<li><button type="button" data-funnel="${index}"><span>${label}</span><strong>${rows.length}</strong><small>${prior === undefined ? 'Intake cohort' : `${pct(rows.length, prior)} of prior stage · ${prior - rows.length} fewer`}</small></button></li>`;
      }).join('')}</ol>`;
      $('analysis').innerHTML = panel('Funnel statement', 'Same intake cohort from submission to verified sale, at week close.',
        data.cohort.length ? statement + dealerTitle + dealerTable : empty('No records to analyze for these filters.'));
      return;
    }
    if (concept === 'territory-atlas') {
      const max = Math.max(1, ...dealerRows.map(row => row.aging + row.waiting));
      const strips = `<ol class="territories">${dealerRows.map(row => `<li><button type="button" data-facet="territory" data-label="${escape(row.label)}"><span>${escape(row.label)}</span><span class="territory-track"><i style="--width:${row.aging / max * 100}%"></i><i style="--width:${row.waiting / max * 100}%"></i></span><strong>${row.aging + row.waiting}</strong></button></li>`).join('')}</ol>`;
      $('analysis').innerHTML = panel('Dealer pressure by territory', 'Aged uncontacted leads plus leads awaiting assignment. Select a territory to filter.',
        dealerRows.length ? strips + '<div class="legend"><span>Aged uncontacted</span><span>Awaiting assignment</span></div>' + dealerTable : empty('No territory activity for these filters.'));
      return;
    }
    const funnelFirst = state.view === 'exec';
    const content = funnelFirst
      ? `${funnelChart}${dealerTitle}${dealerTable}`
      : `${dealerTable}${funnelTitle}${funnelChart}`;
    $('analysis').innerHTML = panel(funnelFirst ? 'Sales funnel' : 'Dealer execution',
      funnelFirst ? 'One intake cohort, measured at week close.' : 'Ranked by aged uncontacted leads, then unassigned leads.',
      data.cohort.length ? content : empty('No records to analyze for these filters.'));
  }

  function renderMix() {
    const executive = state.view === 'exec';
    const bars = (rows, field) => rows.map(row => {
      const [num, den] = executive ? [row.verified, row.eligible] : [row.eligible, row.received];
      return `<li><button type="button" data-facet="${field}" data-label="${escape(row.label)}"><span>${escape(row.label)}</span><strong>${num}/${den}</strong><span class="mix-track" aria-hidden="true"><i style="--width:${den ? num / den * 100 : 0}%"></i></span></button></li>`;
    }).join('');
    $('mix').innerHTML = panel(concept === 'intake-exchange' ? (executive ? 'Sales outcomes by channel' : 'Intake by channel') : 'Source and product mix',
      (executive ? 'Verified / eligible by week close.' : 'Eligible / received.') + ' Select a row to filter the report.',
      data.cohort.length ? `<h3>Lead sources</h3><ul class="mix-list">${bars(data.sources, 'source')}</ul><h3>Product lines</h3><ul class="mix-list">${bars(data.products, 'product')}</ul>` : empty('No source or product data for these filters.'));
  }

  const sorters = {
    priority: (a, b) => Number(b.critical) - Number(a.critical) || a.due - b.due,
    record: (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    owner: (a, b) => a.owner.localeCompare(b.owner),
    due: (a, b) => a.due - b.due,
    status: (a, b) => status(a).localeCompare(status(b)) || a.due - b.due,
    age: (a, b) => reportAge(a) - reportAge(b),
  };
  const status = row => row.due < activePeriod.end ? 'Past due' : 'Open';
  const priority = row => `<span class="priority ${row.critical ? 'critical' : ''}">${row.critical ? 'Critical' : 'Review'}</span>`;
  const review = row => `<button type="button" class="review" data-record="${row.id}" aria-label="Review ${row.id}">Review <span aria-hidden="true">↗</span></button>`;
  const dueLabel = row => `${demo.deadline(row.due)} PHT`;
  const reportAge = row => Number.isFinite(row.reported) && row.reported < activePeriod.end
    ? Math.floor(activePeriod.end - row.reported) : -1;

  function queueTable(rows) {
    const columns = [['Priority', 'priority'], ['Record / issue', 'record'], ['Owner', 'owner'], ['Deadline', 'due'], ['Status', 'status']];
    const verification = concept === 'verification-desk';
    if (verification) columns.splice(3, 0, ['Report age', 'age']);
    const headers = columns.map(([label, key]) => `<th scope="col"${state.sort === key ? ` aria-sort="${state.direction === 1 ? 'ascending' : 'descending'}"` : ''}><button type="button" data-sort="${key}">${label}${state.sort === key ? `<span aria-hidden="true"> ${state.direction === 1 ? '↑' : '↓'}</span>` : ''}</button></th>`).join('');
    const body = rows.map(row => {
      const age = reportAge(row);
      const ageCell = verification ? `<td>${age >= 0 ? (age ? `${age}d` : '< 1d') : '—'}</td>` : '';
      return `<tr><td>${priority(row)}</td><th scope="row">${escape(row.title)}<small>${row.id}</small></th><td>${escape(row.owner)}</td>${ageCell}<td>${dueLabel(row)}</td><td>${status(row)}</td><td>${review(row)}</td></tr>`;
    }).join('');
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="Operational records"><table class="queue-table"><thead><tr>${headers}<th scope="col">Action</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function groupedQueue(rows) {
    const task = row => `<li><div>${priority(row)} <small>${row.id}</small><strong>${row.title}</strong><p>${row.action}</p><small>${escape(row.owner)} · ${dueLabel(row)} · ${status(row)}</small></div>${review(row)}</li>`;
    return ['Critical', 'Review'].map((label, index) => {
      const group = rows.filter(row => row.critical === (index === 0));
      return group.length ? `<div class="task-group"><h3>${index === 0 ? 'Escalate first' : 'Review next'}</h3><ul>${group.map(task).join('')}</ul></div>` : '';
    }).join('');
  }

  const desks = [
    ['Intake & assignment', ['quality', 'assignment']],
    ['Dealer contact', ['contact', 'follow']],
    ['Verification', ['evidence', 'sale']],
  ];

  function handoffLanes(matching) {
    return `<div class="lanes">${desks.map(([label, kinds], desk) => {
      const lane = matching.filter(row => kinds.includes(row.kind));
      const start = board.deskPages[desk] * lanePageSize;
      const rows = lane.slice(start, start + lanePageSize);
      const critical = lane.filter(row => row.critical).length;
      const cards = rows.map(row => `<li><div class="lane-card-top">${priority(row)}<small>${row.id}</small></div>
        <strong>${row.title}</strong>
        <dl class="lane-record"><dt>Owner</dt><dd>${escape(row.owner)}</dd>
        <dt>Deadline</dt><dd>${dueLabel(row)} · ${status(row)}</dd></dl>
        <p class="lane-action">${escape(row.action)}</p>${review(row)}</li>`).join('');
      const pager = lane.length > lanePageSize ? `<div class="pagination lane-pager">
        <span>${start + 1}–${start + rows.length} of ${lane.length}</span>
        <button type="button" data-desk="${desk}" data-lane-step="-1" aria-label="Previous handoffs for ${escape(label)}" ${start ? '' : 'disabled'}>Previous</button>
        <button type="button" data-desk="${desk}" data-lane-step="1" aria-label="Next handoffs for ${escape(label)}" ${start + lanePageSize < lane.length ? '' : 'disabled'}>Next</button>
        </div>` : '';
      return `<section aria-labelledby="desk-title-${desk}"><header class="lane-head">
        <h3 id="desk-title-${desk}">${label}</h3>
        <span>${lane.length} handoffs${critical ? ` · <strong class="critical-text">${critical} critical</strong>` : ''}</span>
        </header>${rows.length ? `<ul>${cards}</ul>${pager}` : empty('No matching handoffs.')}</section>`;
    }).join('')}</div>`;
  }

  function renderQueue() {
    const issueRows = data.queue.filter(row => !state.issue || row.kind === state.issue ||
      (state.issue === 'sales' && ['sale', 'evidence'].includes(row.kind)))
      .sort((a, b) => sorters[state.sort](a, b) * state.direction);
    const lanes = concept === 'handoff-board';
    const rows = lanes && board.criticalOnly ? issueRows.filter(row => row.critical) : issueRows;
    const start = state.page * pageSize;
    const visible = rows.slice(start, start + pageSize);
    const options = Object.entries(kindLabel).map(([key, label]) => `<option value="${key}" ${state.issue === key ? 'selected' : ''}>${label}</option>`);
    const taskSort = ['shift-huddle', 'handoff-board'].includes(concept) ? `<label>Task order<select id="task-sort"><option value="priority">Priority</option><option value="due"${state.sort === 'due' ? ' selected' : ''}>Deadline</option><option value="owner"${state.sort === 'owner' ? ' selected' : ''}>Owner</option></select></label>` : '';
    const saleOption = `<option value="sales"${state.issue === 'sales' ? ' selected' : ''}>All sale verification</option>`;
    const priorityFilter = lanes ? `<button id="critical-only" type="button" class="quiet" aria-pressed="${board.criticalOnly}">Critical only</button>` : '';
    const filters = `<div class="queue-tools"><label>Issue type<select id="issue"><option value="">All issues</option>${saleOption}${options.join('')}</select></label>${taskSort}${priorityFilter}<span>${rows.length} matching issues</span></div>`;
    const canAdvance = start + pageSize < rows.length;
    const pageLabel = `${start + 1}–${start + visible.length} of ${rows.length}`;
    const pager = `<div class="pagination"><span>${pageLabel}</span><button type="button" data-page="-1" ${start ? '' : 'disabled'}>Previous</button><button type="button" data-page="1" ${canAdvance ? '' : 'disabled'}>Next</button></div>`;
    const queueTitle = ({
      'intake-exchange': 'Intake and downstream issues', 'handoff-board': 'Handoff lanes',
      'cohort-ledger': 'Exception register', 'territory-atlas': 'Territory action queue',
      'verification-desk': 'Verification review queue', 'shift-huddle': 'Work for this shift',
    })[concept];
    const listing = concept === 'shift-huddle' ? groupedQueue(visible) : lanes ? handoffLanes(rows) : queueTable(visible);
    $('queue').innerHTML = panel(queueTitle,
      'One next action per record. Deadlines shown in Manila time.',
      filters + (rows.length ? listing + (lanes ? '' : pager)
        : lanes && board.criticalOnly ? empty('No critical handoffs match. Turn off Critical only or change the report filters.')
        : empty('No exceptions match these filters. Clear the issue type or change the report filters.')));
  }

  function render() {
    const [period, source, product, territory] = controls.map(control => control.value);
    const index = Number(period);
    activePeriod = demo.periods[index];
    const previous = demo.snapshot({ start: activePeriod.start - 7, end: activePeriod.start }, source, product, territory);
    data = demo.snapshot(activePeriod, source, product, territory);
    metrics = getMetrics(data, previous);
    $('subtitle').textContent = `${state.view === 'ops' ? 'Daily Operations' : 'Executive Overview'} · Philippine sales leads · ${demo.dayLabel(activePeriod.end - 1)} close, PHT`;
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === state.view)));
    renderMetrics();
    renderAttention();
    renderQueue();
    renderTrend();
    renderAnalysis();
    renderMix();
    $('report-status').textContent = `${state.view === 'ops' ? 'Daily Operations' : 'Executive Overview'} updated. ${data.cohort.length} submissions and ${data.queue.length} exceptions.`;
  }

  function show(title, content) {
    $('detail-title').textContent = title;
    $('detail-body').innerHTML = content;
    $('detail').showModal();
  }

  function showRecords(title, note, rows) {
    show(title, `<p>${escape(note)}</p><p><strong>${rows.length} matching records</strong></p>` + (rows.length
      ? simpleTable(['Lead ID', 'Source', 'Product line', 'Territory'], rows.map(row => [row.id, row.source, row.product, row.territory]))
      : empty('There are no matching records in this selection.')));
  }

  function showIssue(row) {
    show(row.title, `<p class="detail-id">${row.id} · ${priority(row)}</p><dl class="detail-fields">
      ${[['Owner', row.owner], ['Deadline', dueLabel(row)], ['Status', status(row)], ['Lead source', row.source],
        ['Product line', row.product], ['Territory', row.territory], ['Received', demo.dayLabel(row.received)],
        ...(row.kind === 'sale' || row.kind === 'evidence' ? [['Report age', `${Math.floor(activePeriod.end - row.reported)} full days at close`]] : [])]
        .map(([name, value]) => `<div><dt>${name}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl><h3>Next action</h3><p>${escape(row.action)}</p>`);
  }

  function updateQueue(selector, fallback = '#issue') {
    renderQueue();
    const target = document.querySelector(selector);
    if (target && !target.disabled) target.focus();
    else document.querySelector(fallback).focus();
    $('report-status').textContent = $('queue').querySelector('.queue-tools > span').textContent;
  }

  function resetQueuePages() {
    state.page = 0;
    board.deskPages.fill(0);
  }

  function initialize() {
    controls[0].replaceChildren(...demo.periods.map((period, index) => new Option(period.name, index)));
    controls[1].replaceChildren(new Option('All sources', ''), ...demo.sources.map(label => new Option(label)));
    controls[2].replaceChildren(new Option('All product lines', ''), ...demo.products.map(label => new Option(label)));
    controls[3].replaceChildren(new Option('All territories', ''), ...demo.territories.map(label => new Option(label)));
    $('territory-filter').hidden = concept !== 'territory-atlas';
    const resetQueue = () => { resetQueuePages(); state.issue = defaultIssue; };
    $('filters').addEventListener('submit', event => event.preventDefault());
    $('filters').addEventListener('change', () => { resetQueue(); render(); });
    $('filters').addEventListener('reset', event => {
      event.preventDefault();
      controls.forEach(control => { control.selectedIndex = 0; });
      board.criticalOnly = false;
      resetQueue();
      render();
    });
    document.addEventListener('change', event => {
      if (event.target.id === 'issue') {
        state.issue = event.target.value;
        resetQueuePages();
        updateQueue('#issue');
      }
      if (event.target.id === 'task-sort') {
        state.sort = event.target.value;
        resetQueuePages();
        updateQueue('#task-sort');
      }
    });
    document.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      const { view, metric, record, kind, sort, page, facet, label, funnel, age, desk, laneStep } = button.dataset;
      if (view && view !== state.view) {
        state.view = view;
        resetQueue();
        render();
      } else if (metric) {
        const selected = metrics.find(item => item.key === metric);
        showRecords(selected.label, selected.definition, selected.rows);
      } else if (record) {
        showIssue(data.queue.find(row => row.id === record));
      } else if (age !== undefined) {
        const bucket = Number(age);
        showRecords('Pending reports by age', 'Synthetic dealer-reported sales within the selected age band.',
          data.pending.filter(row => Math.min(2, Math.floor(activePeriod.end - row.reported)) === bucket));
      } else if (kind) {
        state.issue = kind;
        resetQueuePages();
        updateQueue('#issue');
        $('queue').scrollIntoView({ block: 'start' });
      } else if (sort) {
        state.direction = state.sort === sort ? -state.direction : 1;
        state.sort = sort;
        resetQueuePages();
        updateQueue(`[data-sort="${sort}"]`);
      } else if (button.id === 'critical-only') {
        board.criticalOnly = !board.criticalOnly;
        resetQueuePages();
        updateQueue('#critical-only');
      } else if (laneStep) {
        board.deskPages[Number(desk)] += Number(laneStep);
        const deskControl = `[data-desk="${desk}"]`;
        updateQueue(`${deskControl}[data-lane-step="${laneStep}"]`, `${deskControl}[data-lane-step="${-Number(laneStep)}"]`);
        $('report-status').textContent = `${desks[Number(desk)][0]}, ${document.querySelector(`#desk-title-${desk}`).closest('section').querySelector('.lane-pager span').textContent}.`;
      } else if (page) {
        state.page += Number(page);
        updateQueue(`[data-page="${page}"]`);
      } else if (facet) {
        $(facet).value = label;
        resetQueue();
        render();
        $(facet).focus();
      } else if (funnel !== undefined) {
        const [name, rows] = [['Received', data.cohort], ['Eligible', data.eligible], ['Assigned', data.assigned], ['Contacted', data.contacted], ['Verified', data.verified]][Number(funnel)];
        showRecords(name, 'Records from the selected intake cohort that reached this stage before week close.', rows);
      }
    });
    render();
    $('load-state').hidden = true;
  }

  try {
    initialize();
  } catch (error) {
    slots.forEach(id => { $(id).hidden = true; });
    controls.forEach(control => { control.disabled = true; });
    $('load-state').textContent = 'The synthetic report could not load. Reload this page to try again.';
    console.error(error);
  }
})();
