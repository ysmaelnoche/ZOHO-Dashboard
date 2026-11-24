export type IssueKind = 'follow-up' | 'assignment' | 'verification';
export type Priority = 'Critical' | 'High' | 'Routine';

export interface QueueIssue {
  id: string;
  kind: IssueKind;
  priority: Priority;
  issue: string;
  owner: string;
  deadline: string;
  status: string;
  nextAction: string;
}

export interface DashboardSnapshot {
  period: string;
  updatedAt: string;
  metrics: {
    newLeads: number;
    unassigned: number;
    overdue: number;
    pendingVerification: number;
  };
  queue: readonly QueueIssue[];
  activity: readonly { date: string; leads: number }[];
}

export interface DashboardAdapter {
  load(): Promise<DashboardSnapshot>;
}

export interface ZohoDashboardAdapter extends DashboardAdapter {
  readonly source: 'zoho';
}
