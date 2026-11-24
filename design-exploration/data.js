'use strict';

const demo = (() => {
  const sources = ['Messenger', 'Meta Instant Forms', 'Website'];
  const products = ['Two-Wheels', 'Three-Wheels'];
  const territories = ['Metro Manila', 'North Luzon', 'South Luzon', 'Visayas', 'Mindanao'];
  const dayMs = 86400000;
  const calendar = new Date('2025-07-01T00:00:00+08:00').getTime();
  const date = new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' });
  const dayLabel = day => date.format(calendar + day * dayMs);
  const periods = [
    { name: 'Jul 22–28, 2025', start: 21, end: 28 },
    { name: 'Jul 15–21, 2025', start: 14, end: 21 },
    { name: 'Jul 8–14, 2025', start: 7, end: 14 },
  ];
  const issues = {
    contact: ['First contact overdue', 'Ask the dealer to confirm the first contact attempt.'],
    assignment: ['Dealer assignment overdue', 'Confirm territory and assign an eligible dealer.'],
    follow: ['Follow-up overdue', 'Confirm the latest customer activity with the dealer.'],
    evidence: ['Sale evidence missing', 'Request the missing verification evidence from the dealer.'],
    sale: ['Sale awaiting verification', 'Review the submitted sale verification evidence.'],
    quality: ['Intake needs review', 'Check the sample record for missing details or a possible duplicate.'],
  };

  // Deterministic fixture generation. Timestamps are fractional Manila calendar days.
  let seed = 17731;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const records = [];
  const intake = [16,14,20,17,15,11,9,15,19,16,20,16,11,13,19,17,22,18,20,13,12,20,24,18,25,26,17,15];
  intake.forEach((count, day) => {
    for (let index = 0; index < count; index += 1) {
      const received = day + .34 + random() * .34;
      const source = sources[Math.floor(random() * sources.length)];
      const product = products[random() < .73 ? 0 : 1];
      const territory = territories[Math.floor(random() * territories.length)];
      const eligible = random() > .14;
      const assigned = eligible && random() > (day >= 21 ? .13 : .07) ? received + .12 + random() * 2.1 : Infinity;
      const contacted = Number.isFinite(assigned) && random() > .10 ? assigned + .12 + random() * 2.3 : Infinity;
      const reported = Number.isFinite(contacted) && random() < .31 ? contacted + .35 + random() * 1.8 : Infinity;
      const evidence = random() > .29;
      const verified = Number.isFinite(reported) && evidence && random() > .14 ? reported + .15 + random() * 1.6 : Infinity;
      const follow = Number.isFinite(contacted) && !Number.isFinite(reported) && random() < .33 ? contacted + 1.25 : Infinity;
      records.push({
        id: 'PH-DEMO-' + String(1001 + records.length), received, source, product, territory, eligible,
        assigned, contacted, reported, evidence, verified, follow,
        quality: !eligible && random() < .62,
      });
    }
  });

  function exception(row, end) {
    const { assigned, contacted, reported, verified, eligible, received, follow, evidence, quality } = row;
    if (reported < end && verified >= end) return [evidence ? 'sale' : 'evidence', reported + 2, 'Verification desk'];
    if (assigned < end && contacted >= end && assigned + 1 < end) return ['contact', assigned + 1, row.territory + ' dealer desk'];
    if (eligible && assigned >= end && received + 1 < end) return ['assignment', received + 1, 'Central CRM'];
    if (follow < end) return ['follow', follow, row.territory + ' dealer desk'];
    if (quality) return ['quality', received + 2, 'Intake desk'];
    return null;
  }

  function snapshot(period, source, product, territory) {
    const { start, end } = period;
    const cohort = records.filter(row => row.received >= start && row.received < end &&
      (!source || row.source === source) && (!product || row.product === product) &&
      (!territory || row.territory === territory));
    const eligible = cohort.filter(row => row.eligible);
    const assigned = eligible.filter(row => row.assigned < end);
    const contacted = assigned.filter(row => row.contacted < end);
    const verified = contacted.filter(row => row.verified < end);
    const pending = contacted.filter(row => row.reported < end && row.verified >= end);
    const waiting = eligible.filter(row => row.assigned >= end);
    const slaDue = assigned.filter(row => row.assigned + 1 < end);
    const onTime = slaDue.filter(row => row.contacted <= row.assigned + 1);
    const queue = cohort.flatMap(row => {
      const issue = exception(row, end);
      if (!issue) return [];
      const [kind, due, owner] = issue;
      const critical = due < end && (kind === 'contact' || end - due >= 2);
      return [{ ...row, kind, due, owner, critical, title: issues[kind][0], action: issues[kind][1] }];
    }).sort((a, b) => Number(b.critical) - Number(a.critical) || a.due - b.due || a.id.localeCompare(b.id));
    const trend = Array.from({ length: end - start }, (_, index) => {
      const day = start + index;
      return {
        label: dayLabel(day),
        intake: eligible.filter(row => Math.floor(row.received) === day).length,
        contacts: contacted.filter(row => Math.floor(row.contacted) === day).length,
        reported: contacted.filter(row => Math.floor(row.reported) === day).length,
        verified: verified.filter(row => Math.floor(row.verified) === day).length,
      };
    });
    const groups = (keys, field) => keys.filter(key => cohort.some(row => row[field] === key)).map(label => ({
      label,
      received: cohort.filter(row => row[field] === label).length,
      eligible: eligible.filter(row => row[field] === label).length,
      assigned: assigned.filter(row => row[field] === label).length,
      contacted: contacted.filter(row => row[field] === label).length,
      waiting: waiting.filter(row => row[field] === label).length,
      aging: assigned.filter(row => row[field] === label && row.contacted >= end && end - row.assigned >= 2).length,
      verified: verified.filter(row => row[field] === label).length,
    }));
    return { cohort, eligible, assigned, contacted, verified, pending, waiting, slaDue, onTime, queue, trend,
      sources: groups(sources, 'source'), products: groups(products, 'product'), dealers: groups(territories, 'territory') };
  }

  const deadline = day => new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(calendar + day * dayMs);
  return { sources, products, territories, periods, snapshot, deadline, dayLabel };
})();
