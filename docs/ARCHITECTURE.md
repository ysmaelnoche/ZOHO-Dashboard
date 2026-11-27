# Widget architecture

## Hosting and presentation

Daily Operations and Executive Overview are packaged as separate Zoho widgets. `scripts/widgets.cjs` stages each edition with its own markup, loading skeleton, navigation, and report modules before invoking ZET. Both use the same read-only adapter and `/widget.html` index path. The combined local development preview can switch between views using one synthetic snapshot.

The redesign uses a shared top navigation, cool neutral surfaces, Manrope typography, and dark chart panels. Daily Operations puts the work queue below its summary. Executive Overview places activity alongside the management scorecard. Matching series colors and line patterns carry across both views. Red remains reserved for overdue and critical work.

`src/ui/activity-chart.ts` draws Chart.js charts directly from existing report buckets. Daily buckets use straight lines and point markers. A single day and the longer grouped buckets use bars. Series controls affect chart visibility only. Exact counts remain in the accompanying HTML tables, including when canvas or the chart library is unavailable. Chart animation and view fades respect the system reduced-motion preference. The build copies pinned Chart.js and Manrope assets plus their license notices into the ZIP.

`app/widget.html` and `app/styles/` contain the static shell. `src/ui/dashboard.ts` renders the board, filters and drill-downs. `src/data/dashboard.ts` computes the report from normalized Leads records. Both adapters use the supplied picklist mapping in `src/live-settings.ts`. ZET serves the loopback preview and packages `app/widget.html` in the CRM archive. The confirmed Zoho **Index Page** is `/widget.html`. [Widget creation and testing](https://www.zoho.com/crm/developer/docs/widgets/create-widget.html) · [Internal hosting](https://www.zoho.com/crm/developer/docs/widgets/usage.html)

## Reporting scope and authorization

The approved reporting population is the signed-in user's visible records in **PH - Central CRM Leads** (`1234527000030478107`), in the India CRM organization `60066505135`. The custom view applies the Philippine layout, country and **PH Dealer Created is Not Selected** criteria. An all-Philippines total requires a separate approved data scope. The code leaves the third criterion to Zoho and does not interpret its checkbox wire value.

The widget initializes the SDK and reads the approved view automatically when opened in Zoho. Its badge shows **LIVE · READ ONLY** during loading, success, and failure. **Refresh** and **Retry** use the same scoped read. Standalone local loopback loads the synthetic fixture, and the fixture is never loaded in the embedded live path. Keep the installation within the approved personal Home placement in CRM. CRM permissions and the custom view enforce data scope independently of placement.

## Read-only CRM adapter

The original live package received `INVALID_REQUEST` while calling SDK 1.4's `ZOHO.CRM.API.coql({ select_query })` with `FROM Leads#1234527000030478107`, a creation-time cutoff, an ID cursor, and ID sorting. The public 1.4 SDK forwards this as a host `QUERY` operation without an explicit REST API version. Zoho added custom-view syntax to COQL in REST v7. The generic error leaves the exact server-side rejection reason unknown. [Widget SDK releases](https://github.com/zoho/embeddedApp-js-sdk/releases) · [Zoho COQL v7 changes](https://help.zoho.com/portal/zh/community/topic/kaizen-183-coql-apis-enhancements-in-zoho-crm-api-version-7)

The widget now loads the official v1.5 SDK, awaits `ZOHO.embeddedApp.init()`, and uses its built-in Zoho Request Client, `zrc.get('/crm/v8/Leads', { params })`. The SDK resolves the logged-in user's data center and handles authentication. Where available, Lead navigation uses `ZOHO.CRM.UI.Record.open`. [SDK lifecycle](https://www.zoho.com/crm/developer/docs/widgets/create-widget.html) · [Widget ZRC examples](https://www.zohocrm.dev/explore/widgets/v1.5/zrc_code_samples) · [SDK record navigation](https://help.zwidgets.com/help/latest/ZOHO.CRM.UI.Record.html)

Every request supplies `cvid=1234527000030478107`, an explicit comma-separated field allowlist, and `per_page=200`. The call omits `sort_by` and `sort_order` and follows Zoho's custom view order. Source choices come from returned `Lead_Source` values. A null or empty source appears as **Not recorded**. CRM role, profile, field visibility and record sharing are the authorization boundary. [V8 Get Records](https://www.zoho.com/crm/developer/docs/api/v8/get-records.html)

The adapter follows Zoho's `next_page_token` as `page_token` while preserving the other parameters and never passes a numerical `page`. It reads up to 500 pages, rejects duplicate IDs, missing or repeated tokens, and mismatched counts. Each request has a 20-second timeout. The report excludes newly created leads after the local read-start cutoff. The data read is not transactional. The widget publishes the report only after fetching all pages. On failure it shows a safe error code and HTTP status when exposed, along with the operation, view and page. The diagnostic omits raw payloads, record IDs and pagination tokens. [V8 Get Records pagination](https://www.zoho.com/crm/developer/docs/api/v8/get-records.html)

The adapter expects offset-bearing timestamps, boolean flags, a nullable lookup with a string ID, and nullable text for stages, outcome and attention reason. It matches the supplied picklist labels exactly and uses simpler wording in the interface. The query requests `Full_Name` for cards, lead lists and details. Omitted or blank names display as **Name unavailable**. Lead IDs support pagination and record navigation. The dealer contact lookup supports assignment metrics and lane labels. Names, contact labels and attention reasons are escaped. Phone numbers, emails and addresses are excluded from the query.

## Daily Operations metrics

Each measure is restricted to the current Central CRM view and CRM visibility. All date comparisons use `Asia/Manila`. Lead Source narrows all displayed measures within the returned population. The selected intake period applies to lead creation and recorded first-update activity. Backlog and recorded stage distribution span all intake dates.

| Measure | Rule |
| --- | --- |
| Total and new Central CRM leads | All visible records in the scoped view, plus the subset created during the Manila intake period. |
| Recorded stage distribution | Counts each record's current `Lead_Stage`, with a bucket for missing and unmapped values. Recorded Sold is a CRM classification. A verified-sale metric is withheld. |
| Active opportunities | `Lead_Stage = Opportunity` among workflow-enabled records in New, Central Review or With Dealer. Closed controls operational closure. |
| Central CRM review | All records explicitly in Central Review, including those whose workflow flag is off. |
| Assigned and unassigned | Partition of active workflow-enabled records based on the assigned contact lookup. |
| Awaiting first update | Assigned active leads with no first-update or follow-up timestamp and no Contacted outcome, excluding Central Review and verification-flagged leads. |
| Interested and missing date | Active records marked Contacted - Interested. A missing next-action timestamp is flagged. A closed workflow removes the record from this active count. |
| Due and overdue | Active work outside Central Review. After a recorded first update, follow-up, Contacted outcome, or explicit verification flag, use Next Action Due. Before then, the assigned lead's first-contact SLA takes precedence, with a recorded next action used if the first SLA is absent. An earlier deadline is overdue. An outstanding deadline on the current Manila day is due today. |
| Attention and verification | Count the CRM attention flag independently. A flagged Sale Verification reason identifies work for review. Sale Reported alone does not qualify. Enabled records with an unmapped workflow stage and no Closed stage are flagged separately. |
| Attention triage | Each CRM-flagged lead belongs to one verified, missing or unmapped reason group across all intake dates under the selected Lead Source. Group totals sum to Attention required. Past due counts leads whose current work deadline is earlier than the read start. Oldest lead is the earliest Manila creation date in that group. Sort groups by past-due count, then flagged volume and earliest creation date. |
| Dealer execution | Group active assigned records by current contact. Show recorded updates, follow-up timestamps, leads awaiting an update and overdue deadlines on the same assigned population. Contact success and SLA attainment rates are withheld until the event semantics are validated. |

A lead occupies at most one queue card. Additional flags can overlap across totals. Central Review keeps its card in the intake desk. Other verification-flagged cards go to the verification desk. KPI drill-downs show the first 200 matching IDs and count all matches.

Select a reason under **Why leads need attention** to filter all three work queue lanes to that group. **Clear reason** returns to all CRM-flagged leads. Changing **Issue type** clears the reason filter. Lanes prioritize critical work, then the earliest current deadline, then the oldest lead. Lead details show both CRM deadline fields and the due date used in the queue.

## Executive Overview measures

Executive counts are restricted to visible records from **PH - Central CRM Leads** and the selected Lead Source. Totals represent this Central CRM view. Reporting on dealer-created leads requires a separately approved Philippine view or views, verified criteria and record sharing, and reconciliation by Lead ID across the authorized population.

| Measure | Rule |
| --- | --- |
| New leads and sources | Use `Created_Time`. Today, Last 7 days and Last 30 days include the current Manila day up to the snapshot time. The prior window starts the same number of days earlier and ends at the same Manila time of day. Unknown sources are shown as Not recorded. |
| Current assignment and first update | Count a record as assigned when its current dealer contact lookup is present, including closed records. An update counts when `First_Dealer_Update_At` is present and no later than the snapshot. The count reflects a recorded update and can include unsuccessful contact attempts. |
| Open leads and opportunities | Count workflow-enabled leads in New, Central Review or With Dealer. Count Opportunity within that population using `Lead_Stage`. Open leads without a dealer have no current assigned contact. |
| Follow-ups | Count open leads marked Contacted - Interested or Contacted - Follow-up Needed, excluding Central Review and records flagged for sale verification. Past due means `Next_Action_Due` is before the snapshot time. No follow-up date means that field is empty. These counts cover the identified follow-up population and do not use the original first-contact deadline. |
| Dealer comparison | Group by the ID of the current `Assigned_PH_Dealer_Contact` lookup. A dealership may have multiple contacts. **All dates** shows all currently assigned records and **Created in reporting period** restricts every column to leads added within that window. The date filter uses creation time. Waiting for first update uses the Daily Operations rule. |
| Assigned lead share | The donut and its count list use the Dealer performance table’s **Assigned** column under the same filters. The denominator is total currently assigned leads in that selection, including closed leads. The five largest contacts appear separately. The `Other contacts` slice sums the rest. |
| Activity in period by dealer | Count each lead once if its first update or latest follow-up timestamp falls in the selected window and is no later than the snapshot. Attribute it to the current contact. The field for latest follow-up cannot reconstruct earlier follow-up events or identify the original dealer. |
| Activity trend | Count new leads by `Created_Time` and first updates by `First_Dealer_Update_At`. Updates can refer to older leads. The longer date window groups days in sets of up to seven starting on the first selected day. |
| Current sales and work stages | Count the current `Lead_Stage` and `PH_Workflow_Stage` independently, across all lead dates. Both distributions include a missing or unrecognized group when needed and reconcile with the total. Sold, Not Sold and Lost are current Lead Stage labels. |

Historical opportunity and closure conversion needs dated stage transitions, a defined intake cohort, and a consistent observation window. Newly assigned volume and attribution to the dealer who did the work need assignment history or event records. Verified sales need the authoritative Central CRM verification field or rule and a verification date. A contact success or response-time measure needs confirmed contact event semantics and a verified start timestamp. Dealership-level rollups need a verified contact-to-dealership mapping.

## Validation boundary

Browser tests cover standalone demo rendering and simulated Zoho startup, including a loading state, automatic loading on reopen, Refresh, Retry, empty results and live errors. Confirm the automatic startup in the actual personal Home after replacing the ZIP. [Controlled validation checklist](CRM_METADATA_CHECKLIST.md)
