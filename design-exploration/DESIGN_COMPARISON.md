# TVS Philippines CRM design comparison

Six interactive proposals for Daily Operations and Executive Overview. All figures are synthetic. The layout comparisons start from the same week, sources and product lines.

**Selected direction for refinement** — [Handoff Board](concept-02.html).

## Open and compare

From the repository root, run `node design-exploration/preview.cjs` and open [the gallery](http://127.0.0.1:5070/). The preview uses Node's built-in HTTP server and has no install step. You can also open `index.html` from disk. The gallery's **Compare two concepts** control opens two interactive previews with independent filters.

| Concept | Interactive HTML | Desktop screenshot |
| --- | --- | --- |
| Intake Exchange | [Interactive preview](concept-01.html) | [Screenshot](screenshots/concept-01.png) |
| Handoff Board | [Interactive preview](concept-02.html) | [Screenshot](screenshots/concept-02.png) |
| Cohort Ledger | [Interactive preview](concept-03.html) | [Screenshot](screenshots/concept-03.png) |
| Territory Atlas | [Interactive preview](concept-04.html) | [Screenshot](screenshots/concept-04.png) |
| Verification Desk | [Interactive preview](concept-05.html) | [Screenshot](screenshots/concept-05.png) |
| Shift Huddle | [Interactive preview](concept-06.html) | [Screenshot](screenshots/concept-06.png) |

## Assessment

Scores are a design assessment on a scale of 1–5, where 5 indicates a strong fit for the criterion. Zoho fit reflects static delivery and constrained layout. An authenticated Zoho iframe was outside this exploration.

| Concept | Visual craft | Information clarity | Operations | Executive | Responsive | Accessibility | Zoho fit | Ease of development |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Intake Exchange | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 |
| Handoff Board | 4 | 4 | 5 | 3 | 4 | 4 | 4 | 3 |
| Cohort Ledger | 5 | 5 | 4 | 5 | 4 | 4 | 5 | 4 |
| Territory Atlas | 5 | 4 | 4 | 5 | 4 | 4 | 4 | 3 |
| Verification Desk | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 |
| Shift Huddle | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 4 |

### 01 · Intake Exchange

A source-first workbench with a green-tinted channel rail, combined with a wider intake-versus-contact view. Channel and product rows set the report filters. Intake staff can compare eligibility and quality exceptions before inspecting the downstream queue. The executive view changes the breakdown to verified sales per eligible lead, exposing how acquisition quality varies by channel. Its scope is strongest for acquisition or CRM intake teams. A narrower container places the source board below the lead-flow summary, with the persistent source selector still at the top.

### 02 · Handoff Board

A dispatch workspace organized around intake and assignment, dealer contact, and verification. A persistent left rail provides section navigation at wide widths. Each desk has independent pagination, a total and critical count, and cards with labeled owner, deadline and next action. A Critical only filter narrows all desks to urgent handoffs. The executive view surfaces contact SLA, verified conversion and a cohort funnel. At narrow widths the desks stack. Production adaptation would require validated desk ownership and checks on focus behavior when live data updates.

### 03 · Cohort Ledger

An accounting-style statement with refined serif headings and thin rules. Each funnel stage shows its count, retained share of the preceding stage and the drop-off in records. Selecting the stage opens the matching leads. The exception register supports operational follow-through, while leaders get clear leakage and verified conversion. This is the strongest analytical proposal. The table scrolls on narrow widgets, and the register is lower on the page than in the operations-first concepts. Production would need agreed cohort semantics and stable handling of partial or censored periods.

### 04 · Territory Atlas

A dark, region-first workbench. Ranked strips split dealer pressure into aged uncontacted leads and unassigned leads. Selecting a territory filters the entire view. A supporting dealer table shows the contact-rate denominator, assigned volume and verified counts. This is a strong option for assigning field support and investigating execution differences. It needs reliable dealer-to-territory metadata, permission-aware territory filters and an accessibility check against the actual Zoho host theme. Its dealer table remains horizontally scrollable at narrow widths.

### 05 · Verification Desk

An evidence-oriented workspace with a concise review header, sale-first queue and independent pending-age rail. Operators can inspect missing evidence and open each age band. Leadership sees dealer reports versus verifications by day and denominator-defined conversion. This is the most focused option for the verification team. The default sale filter is clearly visible and exposes All issues for broader operations. Production would depend on a verified evidence lifecycle and an approved method of displaying evidence status to each role.

### 06 · Shift Huddle

An agenda-style workspace built around the first issue to review at each desk, followed by a priority-grouped task list. Owners, deadlines and next steps are readable inline. A compact side summary keeps outcomes nearby. This is effective for coordinating daily work and remains readable without horizontal scrolling in the primary task area. The executive view provides outcome KPIs and funnel context, although it gives less immediate space to diagnostic comparisons. The main production design question is how to explain and calibrate the priority rules with operators.

## Recommended finalists

- **Shift Huddle** for the primary Daily Operations audience. Owners and next actions are immediately readable, and the page remains useful in a narrow widget without relying on a wide primary queue table.
- **Cohort Ledger** for executive oversight and analytical review. The funnel makes every denominator and stage loss inspectable, and its statement layout makes the same data understandable in a constrained frame.

## Synthetic dataset and metric rules

Each deterministic synthetic record has a fictional PH identifier, source, product line and territory, and illustrative received, assigned, contacted, follow-up, reported and verified timestamps. Desk labels are fictional organizational roles. Dates are anchored to July 2025 in Manila time. The three selectable weeks share the same source records and use a prior seven-day comparator where displayed. Time windows are start-inclusive and end-exclusive. The sample deliberately includes delayed events, incomplete submissions and unresolved cases.

All measures apply to the selected **intake cohort**, meaning records received during the reporting week with the chosen filters. Later stage events only count before the same week closes. This includes the active exception queue and excludes unresolved work received in earlier weeks. Recent cohorts may have less time to progress. These are demonstration rules, with no assertion about TVS's actual lead eligibility, thresholds, permissions, fields or workflows.

| Measure | Calculation and use |
| --- | --- |
| Submissions and eligible intake | All received records and the subset marked eligible. Eligible weekly change is a count difference against the previous week with the same filters. |
| Awaiting assignment | Eligible leads with no assignment by period close. The sample flags a queue issue after one day awaiting assignment. |
| First-contact SLA | Assigned leads contacted within 24 hours of assignment divided by assigned leads whose 24-hour deadline elapsed before close. A dash indicates no eligible denominator. |
| Contact and follow-up exceptions | First contact due and absent, or sample follow-up deadline elapsed while follow-up is unresolved. The generated follow-up timestamp represents unresolved work when present. |
| Contacted and territory contact rate | Leads with first contact recorded before close. Territory contact rate divides contacted by assigned leads in that territory. |
| Lead flow | Daily eligible receipts and first-contact events for the filtered cohort. Eligible intake minus first contacts is the number of eligible leads still without first contact at close. |
| Territory pressure | Eligible unassigned leads plus assigned leads uncontacted at least 48 hours after assignment. These are mutually exclusive groups. |
| Pending verification and evidence | Reported before close with no verification before close. Evidence status is an illustrative flag. Age uses elapsed time since report, with separate under-24h, 24–48h and 48h-plus groups. |
| Verified sales and conversion | Verified before close. Conversion divides verified by eligible received for the same cohort. The count comparison uses the equivalent previous-week close. |
| Funnel counts and retention | Received → Eligible → Assigned → Contacted → Verified. Retention divides the current stage by the prior stage. The displayed decrease is a count difference. |
| Source and product mix | Operations displays eligible over received. Executive displays verified over eligible. Each comparison row can filter the report. |
| Priority | One open issue per record, with pending sales, overdue first contact or assignment, unresolved follow-up and intake quality evaluated in that order. Overdue first contacts and issues at least two days overdue are critical. Default order is critical-first, then earliest deadline. |

Model-level demand, source-delivery outages, and live dealer performance are omitted. The fixture supplies no evidence for those indicators.

## Local validation

Run `node design-exploration/verify.cjs --capture --verify-error` from the repository root. It uses the existing Playwright Core dependency with Microsoft Edge. For another Chromium installation set `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. It checks 216 reporting-filter combinations for conservation and reconciles browser conversion drill-downs against the record dataset. It tests view switching, filters, queue sorting, pagination, keyboard detail dialogs, paired gallery previews, narrow layouts, and the missing-dataset error. It also captures desktop screenshots and checks a direct file preview. All six concepts use local assets and make no Zoho requests.

Static iframe sizing, real Zoho navigation and assistive technology behavior still need validation in an authorized environment once a design is selected. Wide tables expose a keyboard-focusable scroll region, touch-width layouts collapse multicolumn structures, and charts expose a daily values table.
