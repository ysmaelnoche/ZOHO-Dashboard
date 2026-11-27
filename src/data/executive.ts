import { manilaDay } from './manila.js';
import type { DealerContact, Lead, WorkflowPolicy } from './dashboard.js';

const dayMs = 86_400_000;
const newActivity = () => ({ created: 0, updates: 0 });
const newDealerCounts = () => ({
  assigned: 0, open: 0, updated: 0, activity: 0, awaiting: 0, opportunities: 0,
  followUps: 0, overdue: 0, missingDate: 0, sold: 0,
});
export type DealerCounts = ReturnType<typeof newDealerCounts>;
interface DealerComparison { contact: DealerContact; all: DealerCounts; period: DealerCounts }

export function summarizeAssignments(assignments: readonly { label: string; count: number }[]) {
  const ranked = assignments.filter(row => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const total = ranked.reduce((sum, row) => sum + row.count, 0);
  const slices = ranked.slice(0, 5);
  if (ranked.length > slices.length) {
    const remainder = ranked.slice(slices.length);
    slices.push({
      label: 'Other contacts (' + remainder.length + ')',
      count: remainder.reduce((sum, row) => sum + row.count, 0),
    });
  }
  return { total, slices };
}

const countStage = (counts: Map<string, number>, stage: string | null) => {
  const key = stage !== null && counts.has(stage) ? stage : 'Not recorded or unrecognized';
  counts.set(key, (counts.get(key) ?? 0) + 1);
};

export function summarizeExecutive(leads: readonly Lead[], policy: WorkflowPolicy, asOf: number, days: number) {
  const start = Date.parse(manilaDay(asOf) + 'T00:00:00+08:00') - (days - 1) * dayMs;
  const previousStart = start - days * dayMs;
  const previousEnd = asOf - days * dayMs;
  const bucketSize = days > 7 ? 7 : 1;
  const buckets = Array.from({ length: Math.ceil(days / bucketSize) }, (_, index) => ({
    ...newActivity(), start: start + index * bucketSize * dayMs,
    end: start + (Math.min((index + 1) * bucketSize, days) - 1) * dayMs,
  }));
  const current = newActivity();
  const previous = newActivity();
  const totals = { leads: 0, assigned: 0, firstUpdates: 0, openUnassigned: 0, opportunities: 0,
    followUps: 0, overdueFollowUps: 0, missingNextAction: 0 };
  const salesStages = new Map(policy.leadStages.map(stage => [stage, 0]));
  const workflowStages = new Map([...policy.activeStages, policy.closedStage].map(stage => [stage, 0]));
  const dealers = new Map<string, DealerComparison>();
  const sources = new Map<string | null, { source: string | null; current: number; previous: number }>();
  const seen = new Set<string>();

  for (const lead of leads) {
    if (lead.created > asOf || seen.has(lead.id)) continue;
    seen.add(lead.id);
    totals.leads++;
    countStage(salesStages, lead.stage);
    countStage(workflowStages, lead.workflow);

    const inPeriod = lead.created >= start;
    const inPrevious = lead.created >= previousStart && lead.created <= previousEnd;
    if (inPeriod || inPrevious) {
      const source = sources.get(lead.source) ?? { source: lead.source, current: 0, previous: 0 };
      if (inPeriod) {
        current.created++;
        source.current++;
        buckets[Math.floor((lead.created - start) / (dayMs * bucketSize))].created++;
      } else {
        previous.created++;
        source.previous++;
      }
      sources.set(source.source, source);
    }

    const first = lead.firstUpdate !== null && lead.firstUpdate <= asOf ? lead.firstUpdate : null;
    if (first !== null) {
      totals.firstUpdates++;
      if (first >= start) {
        current.updates++;
        buckets[Math.floor((first - start) / (dayMs * bucketSize))].updates++;
      } else if (first >= previousStart && first <= previousEnd) {
        previous.updates++;
      }
    }

    const open = lead.enabled && lead.workflow !== null && lead.workflow !== policy.closedStage &&
      policy.activeStages.includes(lead.workflow);
    const inReview = lead.workflow === policy.reviewStage;
    const saleCheck = lead.attention && lead.reason === policy.verificationReason;
    const contacted = lead.outcome !== null && policy.contactedOutcomes.includes(lead.outcome);
    const latestFollowUp = lead.lastFollowUp !== null && lead.lastFollowUp <= asOf ? lead.lastFollowUp : null;
    const progressed = first !== null || latestFollowUp !== null || contacted;
    const recentActivity = (first !== null && first >= start) || (latestFollowUp !== null && latestFollowUp >= start);
    const awaiting = open && !inReview && !saleCheck && !progressed;
    const opportunity = open && lead.stage === policy.opportunityStage;
    const followUp = open && !inReview && !saleCheck && contacted;
    const overdue = followUp && lead.nextDue !== null && lead.nextDue < asOf;
    const missingDate = followUp && lead.nextDue === null;

    totals.opportunities += Number(opportunity);
    totals.followUps += Number(followUp);
    totals.overdueFollowUps += Number(overdue);
    totals.missingNextAction += Number(missingDate);
    if (!lead.dealer) {
      totals.openUnassigned += Number(open);
      continue;
    }
    totals.assigned++;
    const row = dealers.get(lead.dealer.id) ?? { contact: lead.dealer, all: newDealerCounts(), period: newDealerCounts() };
    for (const counts of inPeriod ? [row.all, row.period] : [row.all]) {
      counts.assigned++;
      counts.open += Number(open);
      counts.updated += Number(first !== null);
      counts.activity += Number(recentActivity);
      counts.awaiting += Number(awaiting);
      counts.opportunities += Number(opportunity);
      counts.followUps += Number(followUp);
      counts.overdue += Number(overdue);
      counts.missingDate += Number(missingDate);
      counts.sold += Number(lead.stage === 'Sold');
    }
    dealers.set(row.contact.id, row);
  }

  return {
    totals, dealers: [...dealers.values()],
    activity: { start, previousStart, previousEnd, asOf, current, previous, buckets },
    sources: [...sources.values()].sort((a, b) =>
      b.current - a.current || b.previous - a.previous || (a.source ?? '').localeCompare(b.source ?? '')),
    salesStages: [...salesStages].map(([label, count]) => ({ label, count })),
    workflowStages: [...workflowStages].map(([label, count]) => ({ label, count })),
  };
}

export type ExecutiveReport = ReturnType<typeof summarizeExecutive>;
