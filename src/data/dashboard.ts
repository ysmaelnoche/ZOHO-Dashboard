import { manilaDay } from './manila.js';

export { manilaDay };
export interface DealerContact { id: string; name: string }

export interface Lead {
  id: string;
  name: string | null;
  created: number;
  dealer: DealerContact | null;
  workflow: string | null;
  stage: string | null;
  outcome: string | null;
  enabled: boolean;
  nextDue: number | null;
  firstUpdate: number | null;
  firstDue: number | null;
  lastFollowUp: number | null;
  attention: boolean;
  reason: string | null;
  source: string | null;
}

export interface WorkflowPolicy {
  leadStages: readonly string[];
  activeStages: readonly string[];
  closedStage: string;
  reviewStage: string;
  opportunityStage: string;
  interestedOutcome: string;
  contactedOutcomes: readonly string[];
  attentionReasons: readonly string[];
  verificationReason: string;
}

export interface LeadSnapshot {
  leads: readonly Lead[];
  policy: WorkflowPolicy;
  asOf: number;
}
export interface DashboardAdapter { load(): Promise<LeadSnapshot> }

export type IssueKind = 'central-review' | 'unassigned' | 'first-update' | 'follow-up' | 'missing-follow-up' | 'verification' | 'attention' | 'unmapped';
export type Desk = 'intake' | 'contact' | 'verification';

export interface Handoff {
  lead: Lead;
  desk: Desk;
  kinds: IssueKind[];
  deadline: number | null;
  critical: boolean;
  attentionGroup: string | null;
}
export type OverviewMetric = 'newLeads' | 'opportunities' | 'unassigned' | 'awaitingFirst';

interface AttentionGroup {
  key: string;
  label: string;
  count: number;
  overdue: number;
  oldestCreated: number;
}

export function summarize(leads: readonly Lead[], policy: WorkflowPolicy, asOf: number, days: number) {
  const today = manilaDay(asOf);
  const todayStart = Date.parse(today + 'T00:00:00+08:00');
  const dayMs = 86_400_000;
  const activity = Array.from({ length: days }, (_, index) => ({
    date: manilaDay(todayStart - (days - 1 - index) * dayMs), created: 0, firstUpdates: 0,
  }));
  const byDay = new Map(activity.map(day => [day.date, day]));
  const metrics = {
    total: leads.length, newLeads: 0, centralReview: 0, assigned: 0, unassigned: 0, opportunities: 0,
    awaitingFirst: 0, interested: 0, overdue: 0, dueToday: 0, missingFollowUp: 0, attention: 0,
    verification: 0, unmapped: 0,
  };
  const queue: Handoff[] = [];
  const attentionGroups = new Map<string, AttentionGroup>();
  const interestedLeads: Lead[] = [];
  const overview: Record<OverviewMetric, Lead[]> = { newLeads: [], opportunities: [], unassigned: [], awaitingFirst: [] };
  const stageCounts = new Map(policy.leadStages.map(stage => [stage, 0]));
  let unknownStageCount = 0;
  const dealers = new Map<string, { dealer: DealerContact; assigned: number; awaiting: number; updated: number; followedUp: number; overdue: number }>();

  for (const lead of leads) {
    const stageCount = lead.stage === null ? undefined : stageCounts.get(lead.stage);
    if (lead.stage !== null && stageCount !== undefined) stageCounts.set(lead.stage, stageCount + 1);
    else unknownStageCount++;

    const received = byDay.get(manilaDay(lead.created));
    if (received && lead.created <= asOf) {
      received.created++;
      metrics.newLeads++;
      overview.newLeads.push(lead);
    }
    const first = lead.firstUpdate !== null && lead.firstUpdate <= asOf ? lead.firstUpdate : null;
    if (first !== null) {
      const day = byDay.get(manilaDay(first));
      if (day) day.firstUpdates++;
    }

    const closed = lead.workflow === policy.closedStage;
    const mapped = lead.workflow !== null && policy.activeStages.includes(lead.workflow);
    const active = lead.enabled && mapped && !closed;
    const centralReview = lead.workflow === policy.reviewStage;
    const interested = active && lead.outcome === policy.interestedOutcome;
    const verification = lead.attention && lead.reason === policy.verificationReason;
    const followedUp = lead.lastFollowUp !== null && lead.lastFollowUp <= asOf;
    const contactedOutcome = lead.outcome !== null && policy.contactedOutcomes.includes(lead.outcome);
    const progressed = first !== null || followedUp || contactedOutcome;
    const awaiting = active && lead.dealer !== null && !progressed && !verification && !centralReview;
    // A follow-up deadline governs once there is dealer progress. With no first SLA,
    // a recorded next action can still surface as a deadline before the first update.
    const deadline = !active || centralReview ? null : progressed || verification
      ? lead.nextDue : lead.dealer ? lead.firstDue ?? lead.nextDue : null;
    const overdue = deadline !== null && deadline < asOf;
    const dueToday = deadline !== null && !overdue && manilaDay(deadline) === today;

    let attentionGroup = null;
    if (lead.attention) {
      metrics.attention++;
      const reason = lead.reason;
      const knownReason = reason !== null && policy.attentionReasons.includes(reason);
      const missingReason = !reason?.trim();
      attentionGroup = knownReason ? 'reason:' + reason : missingReason ? 'missing' : 'unmapped';
      const group = attentionGroups.get(attentionGroup) ?? {
        key: attentionGroup,
        label: knownReason ? reason : missingReason ? 'Reason not recorded' : 'Unmapped reason',
        count: 0, overdue: 0, oldestCreated: lead.created,
      };
      group.count++;
      if (overdue) group.overdue++;
      group.oldestCreated = Math.min(group.oldestCreated, lead.created);
      attentionGroups.set(attentionGroup, group);
    }
    if (active && lead.stage === policy.opportunityStage) {
      metrics.opportunities++;
      overview.opportunities.push(lead);
    }
    if (interested) {
      metrics.interested++;
      interestedLeads.push(lead);
    }
    if (awaiting) {
      metrics.awaitingFirst++;
      overview.awaitingFirst.push(lead);
    }
    if (overdue) metrics.overdue++;
    if (dueToday) metrics.dueToday++;

    let desk: Desk = 'intake';
    const kinds: IssueKind[] = [];
    if (centralReview) {
      metrics.centralReview++;
      kinds.push('central-review');
    }
    if (active && !lead.dealer) {
      metrics.unassigned++;
      overview.unassigned.push(lead);
      kinds.push('unassigned');
    }
    if (verification) {
      metrics.verification++;
      if (!centralReview) desk = 'verification';
      kinds.push('verification');
    }
    if (awaiting) {
      desk = 'contact';
      kinds.push('first-update');
    } else if (!verification && (overdue || dueToday)) {
      if (lead.dealer) desk = 'contact';
      kinds.push('follow-up');
    }
    if (interested && lead.nextDue === null) {
      if (lead.dealer && !verification && !centralReview) desk = 'contact';
      metrics.missingFollowUp++;
      kinds.push('missing-follow-up');
    }
    if (lead.enabled && !closed && !mapped) {
      metrics.unmapped++;
      kinds.push('unmapped');
    }
    if (lead.attention) kinds.push('attention');
    if (kinds.length) queue.push({ lead, desk, kinds, deadline, critical: overdue || lead.attention, attentionGroup });

    if (active && lead.dealer) {
      metrics.assigned++;
      const row = dealers.get(lead.dealer.id) ?? {
        dealer: lead.dealer, assigned: 0, awaiting: 0, updated: 0, followedUp: 0, overdue: 0,
      };
      row.assigned++;
      if (awaiting) row.awaiting++;
      if (first !== null) row.updated++;
      if (followedUp) row.followedUp++;
      if (overdue) row.overdue++;
      dealers.set(lead.dealer.id, row);
    }
  }

  const salesStages = [...stageCounts].map(([label, count]) => ({ label, count }));
  if (unknownStageCount) salesStages.push({ label: 'Stage needs checking', count: unknownStageCount });
  return { metrics, queue, activity, overview, interestedLeads, salesStages,
    attentionGroups: [...attentionGroups.values()].sort((a, b) =>
      b.overdue - a.overdue || b.count - a.count || a.oldestCreated - b.oldestCreated || a.label.localeCompare(b.label)),
    dealers: [...dealers.values()].sort((a, b) => b.overdue - a.overdue || b.awaiting - a.awaiting) };
}
export type Report = ReturnType<typeof summarize>;
