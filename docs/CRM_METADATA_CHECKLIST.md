# CRM metadata verification

Obtain authorization for metadata inspection and an approved PH-scoped sandbox. Ask the CRM administrator for a metadata export or use approved read-only metadata tools. Record API names, field types, layouts, picklist values, lookup targets and permission evidence in a mapping. Use synthetic sandbox records for behavior checks.

| Business area | Verify before implementation |
| --- | --- |
| Philippine leads | Module and layout API names, Philippines discriminator and who can read or change it, timestamps, active and converted lead handling |
| Source and product interest | Field or related-module API names, picklist taxonomy, lookup cardinality, missing values and attribution rules |
| Dealer assignment | Lead-to-dealer lookup, dealer directory, routing and reassignment history, Central CRM owner versus dealer owner |
| PH Dealer Follow-up | Module and layout, lead and dealer lookups, record owner, contact attempt/completion fields and status lifecycle |
| Deadlines and attention | First-contact and next-action timestamps, attention flag and workflow stage, Manila timezone, SLA calendar, escalation and overdue rules |
| Dealer-reported sales | Module or status representation, lead/dealer relationships, submission time, qualifying evidence and duplicate policy |
| Central CRM verification | Verification status, outcome timestamp, verifier identity, permissions and what counts as pending or verified |
| Daily versus executive aggregation | Reporting windows, definitions, source-of-truth timestamps, duplicates, funnels and reconciliation against approved synthetic samples |

`Lead_Source`, `PH_Attention_Required`, `Next_Action_Due` and `PH_Workflow_Stage` are provisional references. Confirm each before using it in a query.

1. Confirm a sandbox for the India data center and identify PH Central CRM operator, PH management and restricted test roles. Verify module, layout, field, record sharing, ownership and lookup visibility for each role.
2. Demonstrate that users, aggregates, pages, lookups and drill-down links are restricted to authorized Philippine records. Use synthetic fixtures to represent out-of-scope access cases. Keep Indonesian CRM data outside the verification.
3. Confirm the official SDK method and documented permission behavior, criteria semantics, pagination, rate limits, safe error handling and support for the Home widget context.
4. Confirm Home placement and SDK initialization in the approved sandbox. Obtain agreement on KPI definitions and the mapping before enabling a read-only adapter.
5. Obtain separate approval for write actions, production widget creation, deployment or any configuration changes.
