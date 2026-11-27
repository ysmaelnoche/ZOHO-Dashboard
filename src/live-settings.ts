import type { WorkflowPolicy } from './data/dashboard.js';
import type { LiveConfig } from './data/zoho.js';

export const centralCrmView = {
  id: '1234527000030478107',
  name: 'PH - Central CRM Leads',
} as const;

export const phPicklists = {
  leadStage: ['Prospect', 'Sales follow-up', 'Opportunity', 'Sold', 'Not Sold', 'Lost'],
  workflowStage: ['New', 'Central Review', 'With Dealer', 'Closed'],
  dealerOutcome: ['No Answer', 'Contacted - Interested', 'Contacted - Follow-up Needed', 'Not Interested', 'Invalid Contact', 'Need Assistance', 'Sale Reported'],
  attentionReason: ['First Contact Overdue', 'Follow-up Overdue', 'Assistance Needed', 'Invalid Contact', 'Sale Verification'],
} as const;

const policy = {
  leadStages: phPicklists.leadStage,
  activeStages: ['New', 'Central Review', 'With Dealer'],
  closedStage: 'Closed',
  reviewStage: 'Central Review',
  opportunityStage: 'Opportunity',
  interestedOutcome: 'Contacted - Interested',
  contactedOutcomes: ['Contacted - Interested', 'Contacted - Follow-up Needed'],
  attentionReasons: phPicklists.attentionReason,
  verificationReason: 'Sale Verification',
} as const satisfies WorkflowPolicy;

export const liveSettings: LiveConfig = { viewId: centralCrmView.id, policy };
