import type { DashboardAdapter, Lead } from './dashboard.js';
import { liveSettings } from '../live-settings.js';

const asOf = Date.parse('2025-07-28T11:00:00+08:00');
const date = (value: string) => Date.parse('2025-07-' + value + '+08:00');
const desk = { id: 'metro', name: 'Demo Metro desk' };
const otherDesk = { id: 'visayas', name: 'Demo Visayas desk' };

function lead(id: number, overrides: Partial<Lead>): Lead {
  return {
    id: 'PH-DEMO-' + id, name: 'Sample Lead ' + id, created: date('24T09:00:00'), dealer: desk, workflow: 'With Dealer',
    stage: 'Opportunity', outcome: null, enabled: true, nextDue: null, firstUpdate: null,
    firstDue: date('25T10:00:00'), lastFollowUp: null, attention: false, reason: null,
    source: 'Demo web', ...overrides,
  };
}

const leads = [
  lead(101, { attention: true, reason: 'First Contact Overdue' }),
  lead(102, { created: date('18T09:00:00'), dealer: null, workflow: 'Central Review', stage: 'Prospect', firstDue: null }),
  lead(103, { created: date('26T09:00:00'), firstUpdate: date('26T10:00:00'), firstDue: date('27T09:00:00'), outcome: 'Contacted - Interested' }),
  lead(104, { dealer: otherDesk, created: date('25T10:00:00'), firstUpdate: date('25T11:00:00'), nextDue: date('28T15:00:00'), outcome: 'Contacted - Follow-up Needed', source: 'Demo form' }),
  lead(105, { outcome: 'Sale Reported', attention: true, reason: 'Sale Verification', firstUpdate: date('24T14:00:00'), nextDue: date('29T16:00:00') }),
  lead(106, { dealer: otherDesk, outcome: 'Sale Reported', attention: true, reason: 'Sale Verification', firstUpdate: date('24T12:00:00') }),
  lead(107, { dealer: otherDesk, firstUpdate: date('26T12:00:00'), nextDue: date('27T16:00:00'), lastFollowUp: date('27T08:00:00'), outcome: 'Contacted - Interested' }),
  lead(108, { created: date('28T08:30:00'), dealer: null, workflow: 'New', firstDue: null, stage: null, source: 'Demo form' }),
  lead(109, { workflow: 'Closed', firstUpdate: date('25T08:00:00'), stage: 'Not Sold', outcome: 'Not Interested' }),
];

export const mockAdapter: DashboardAdapter = {
  async load() { return { leads, policy: liveSettings.policy, asOf }; },
};
