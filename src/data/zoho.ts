import type { DashboardAdapter, DealerContact, Lead, WorkflowPolicy } from './dashboard.js';

export interface LiveConfig {
  viewId: string;
  policy: WorkflowPolicy;
}

const leadsPath = '/crm/v8/Leads';
interface LeadsParams {
  cvid: string;
  fields: string;
  per_page: number;
  page_token?: string;
}
export type GetLeads = (path: typeof leadsPath, config: { params: LeadsParams }) => Promise<unknown>;
type JsonObject = Record<string, unknown>;
const pageSize = 200;
const maxPages = 500;
const idPattern = /^[1-9]\d{0,24}$/;
const requiredFields = [
  'Created_Time', 'Lead_Source', 'Assigned_PH_Dealer_Contact', 'PH_Workflow_Stage', 'Lead_Stage',
  'PH_Latest_Dealer_Outcome', 'Next_Action_Due', 'First_Dealer_Update_At', 'PH_First_Contact_SLA_Due',
  'PH_Workflow_Enabled', 'PH_Last_Dealer_Follow_up_At', 'PH_Attention_Required', 'PH_Attention_Reason',
] as const;
const requestedFields = [...requiredFields, 'Full_Name'].join(',');

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function asId(value: unknown): string {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error('CRM returned an invalid record or lookup ID.');
  return value;
}

function text(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('CRM returned an unexpected text field format.');
  return value;
}

function date(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new Error('CRM returned a timestamp without the required date, time and offset.');
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('CRM returned an invalid timestamp.');
  return time;
}

function checkbox(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('CRM returned an unexpected checkbox field format.');
  return value;
}

function dealer(value: unknown): DealerContact | null {
  if (value === null) return null;
  const lookup = object(value);
  if (!lookup) throw new Error('CRM returned an unexpected dealer lookup field format.');
  const id = asId(lookup.id);
  return { id, name: typeof lookup.name === 'string' && lookup.name ? lookup.name : 'Dealer contact ' + id };
}

function decode(record: JsonObject): Lead {
  const created = date(record.Created_Time);
  if (created === null) throw new Error('CRM omitted the lead creation timestamp.');
  return {
    id: asId(record.id), name: typeof record.Full_Name === 'string' ? record.Full_Name.trim() || null : null,
    created, dealer: dealer(record.Assigned_PH_Dealer_Contact),
    workflow: text(record.PH_Workflow_Stage), stage: text(record.Lead_Stage), outcome: text(record.PH_Latest_Dealer_Outcome),
    nextDue: date(record.Next_Action_Due), firstUpdate: date(record.First_Dealer_Update_At),
    firstDue: date(record.PH_First_Contact_SLA_Due), enabled: checkbox(record.PH_Workflow_Enabled),
    lastFollowUp: date(record.PH_Last_Dealer_Follow_up_At), attention: checkbox(record.PH_Attention_Required),
    reason: text(record.PH_Attention_Reason), source: text(record.Lead_Source),
  };
}

function crmError(error: unknown): Error {
  const outer = object(error);
  const response = object(outer?.response);
  const payload = object(response?.data) ?? object(outer?.data) ?? object(outer?.details) ?? object(outer?.detail);
  const rawCode = payload?.code ?? outer?.code ?? outer?.name;
  const code = typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,49}$/.test(rawCode) ? rawCode : null;
  // SDK 1.5 can expose the HTTP status in the error message alone.
  const statusInMessage = typeof outer?.message === 'string' ? outer.message.match(/\bstatus(?: code)?\s*:?\s*([45]\d\d)\b/i) : null;
  const rawStatus = response?.status ?? outer?.status ?? outer?.status_code ?? Number(statusInMessage?.[1]);
  const status = typeof rawStatus === 'number' && Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
    ? 'HTTP ' + rawStatus : null;
  const message = code === 'TIMEOUT' ? 'CRM request timed out.' :
    rawStatus === 401 || rawStatus === 403 || (code !== null && /PERMISSION|AUTH|ACCESS|SCOPE/.test(code))
      ? 'CRM denied access to the approved view or its fields.'
      : 'CRM could not read the approved Leads view.';
  const hints = [code, status].filter(Boolean).join(' · ');
  return new Error(message + (hints ? ' ' + hints + '.' : ''));
}

async function readPage(get: GetLeads, params: LeadsParams) {
  let response: unknown;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    response = await Promise.race([
      get(leadsPath, { params }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject({ code: 'TIMEOUT' }), 20000);
      }),
    ]);
  } catch (error) {
    throw crmError(error);
  } finally {
    clearTimeout(timeout);
  }
  const http = object(response);
  if (http?.status === 204) return { records: [], more: false, nextToken: undefined };
  const result = object(http?.data);
  if (http?.status !== 200 || !result || result.code || result.status === 'error') throw crmError(response);
  const info = object(result.info);
  if (!Array.isArray(result.data) || typeof info?.more_records !== 'boolean' || result.data.length > pageSize) {
    throw new Error('CRM returned an incomplete pagination response.');
  }
  if (info.count !== undefined && info.count !== result.data.length) {
    throw new Error('CRM pagination count did not match the page contents.');
  }
  const records = result.data.map(value => {
    const record = object(value);
    if (!record || requiredFields.some(key => !Object.hasOwn(record, key))) {
      throw new Error('CRM omitted a requested field. Check field visibility and the approved mapping.');
    }
    return record;
  });
  const token = info.next_page_token;
  return { records, more: info.more_records, nextToken: typeof token === 'string' && token.trim() ? token : undefined };
}

export function createZohoAdapter(get: GetLeads, config: LiveConfig): DashboardAdapter {
  if (!idPattern.test(config.viewId)) throw new Error('A verified Philippine Leads custom view ID is required.');
  const params = { cvid: config.viewId, fields: requestedFields, per_page: pageSize };
  return {
    async load() {
      const asOf = Date.now();
      const leads: Lead[] = [];
      const seenIds = new Set<string>();
      const seenTokens = new Set<string>();
      let pageToken: string | undefined;
      for (let page = 1; page <= maxPages; page++) {
        try {
          const { records, more, nextToken } = await readPage(get, pageToken ? { ...params, page_token: pageToken } : { ...params });
          if (!records.length && (more || pageToken)) {
            throw new Error('CRM pagination returned an unexpected empty page.');
          }
          for (const record of records) {
            const lead = decode(record);
            if (seenIds.has(lead.id)) throw new Error('CRM pagination returned a duplicate lead.');
            seenIds.add(lead.id);
            if (lead.created <= asOf) leads.push(lead);
          }
          if (!more) return { leads, policy: config.policy, asOf };
          if (!nextToken || seenTokens.has(nextToken)) throw new Error('CRM pagination token is missing or repeated.');
          if (page === maxPages) throw new Error('CRM pagination reached the record limit.');
          seenTokens.add(nextToken);
          pageToken = nextToken;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'CRM read failed.';
          throw new Error(`${message} GET ${leadsPath} · view ${config.viewId} · page ${page}.`);
        }
      }
      throw new Error('CRM pagination reached its safety limit. No partial totals are displayed.');
    },
  };
}
