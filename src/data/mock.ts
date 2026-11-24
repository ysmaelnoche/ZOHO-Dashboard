import type { DashboardAdapter, QueueIssue } from './dashboard.js';

const queue: readonly QueueIssue[] = [
  {
    id: 'PH-DEMO-101', kind: 'follow-up', priority: 'Critical',
    issue: 'First contact overdue', owner: 'Demo · Central CRM',
    deadline: '2025-07-18T09:00:00+08:00', status: 'SLA breached',
    nextAction: 'Confirm contact attempt and record the outcome.',
  },
  {
    id: 'PH-DEMO-102', kind: 'follow-up', priority: 'High',
    issue: 'Dealer follow-up overdue', owner: 'Demo · Dealer desk',
    deadline: '2025-07-18T10:30:00+08:00', status: 'Overdue',
    nextAction: 'Request a follow-up update from the assigned dealer.',
  },
  {
    id: 'PH-DEMO-103', kind: 'assignment', priority: 'High',
    issue: 'Dealer assignment missing', owner: 'Unassigned',
    deadline: '2025-07-18T13:00:00+08:00', status: 'Awaiting assignment',
    nextAction: 'Check territory and assign an eligible dealer.',
  },
  {
    id: 'PH-DEMO-104', kind: 'verification', priority: 'Routine',
    issue: 'Dealer-reported sale', owner: 'Demo · Verification desk',
    deadline: '2025-07-18T16:00:00+08:00', status: 'Pending verification',
    nextAction: 'Review the sale evidence and confirm verification eligibility.',
  },
];

const activity = [
  { date: '2025-07-18', leads: 8 },
  { date: '2025-07-17', leads: 12 },
  { date: '2025-07-16', leads: 9 },
];

export const mockAdapter: DashboardAdapter = {
  async load() {
    return {
      period: 'Jul 16–18, 2025 · PHT',
      updatedAt: new Date().toISOString(),
      metrics: {
        newLeads: activity.reduce((total, day) => total + day.leads, 0),
        unassigned: queue.filter(row => row.kind === 'assignment').length,
        overdue: queue.filter(row => row.kind === 'follow-up').length,
        pendingVerification: queue.filter(row => row.kind === 'verification').length,
      },
      queue,
      activity,
    };
  },
};
