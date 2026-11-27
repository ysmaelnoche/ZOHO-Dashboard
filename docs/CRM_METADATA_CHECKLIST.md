# CRM metadata and read-only validation checklist

## Confirmed for offline implementation

The supplied metadata identifies the India CRM organization `60066505135`, module `Leads`, layout **TVS PH - Lead Management**, and custom view **PH - Central CRM Leads** with ID `1234527000030478107`.

| Condition | Field | Operator | Value in Zoho |
| --- | --- | --- | --- |
| 1 | Layout | is | TVS PH - Lead Management |
| 2 | Address - Country / Region | is | Philippines |
| 3 | PH Dealer Created | is | Not Selected |

Criteria pattern is `((1 AND 2) AND 3)`. Related Modules Criteria is disabled. The widget uses the view ID for all pages and leaves evaluation of the checkbox criterion to Zoho. Validate view membership during the authorized personal Home test. [Checkbox criteria](https://help.zoho.com/portal/en/kb/crm/faqs/customization/articles/faqs-field-customization) · [Custom view metadata](https://www.zoho.com/crm/developer/docs/api/v8/custom-view-meta.html)

| Field API name | Mapped values or use |
| --- | --- |
| `Lead_Stage` | Prospect · Sales follow-up · Opportunity · Sold · Not Sold · Lost. Values are stage labels. Sold is not used as a verified-sale KPI. |
| `PH_Workflow_Stage` | New · Central Review · With Dealer · Closed. Closed controls operational closure. |
| `PH_Latest_Dealer_Outcome` | No Answer · Contacted - Interested · Contacted - Follow-up Needed · Not Interested · Invalid Contact · Need Assistance · Sale Reported. The two Contacted values indicate recorded contact evidence. No outcome alone closes a lead or verifies a sale. |
| `PH_Attention_Reason` | First Contact Overdue · Follow-up Overdue · Assistance Needed · Invalid Contact · Sale Verification. Sale Verification with an explicit attention flag routes work for review. |
| `Assigned_PH_Dealer_Contact` | Assignment lookup. Null indicates no recorded assignment. |
| `PH_Dealer_Email` | Verified API name. Excluded from the query. |
| `Next_Action_Due` and `PH_First_Contact_SLA_Due` | Follow-up and first-contact due timestamps. |
| `First_Dealer_Update_At` and `PH_Last_Dealer_Follow_up_At` | Recorded activity timestamps. |
| `PH_Workflow_Enabled` and `PH_Attention_Required` | Expected boolean flags. |
| `Created_Time` and `id` | Zoho system fields for intake dates and record identity. |
| `Full_Name` | Standard read-only Leads name field. Confirm the logged-in account can read it and that the widget name matches the CRM record. Blank or omitted values show **Name unavailable**. [Zoho Get Records](https://www.zoho.com/crm/developer/docs/api/v8/get-records.html) |
| `Lead_Source` | Standard Leads field requested in the explicit V8 fields list. Confirm read visibility and nullable picklist values under the test account. [Zoho Fields Metadata](https://www.zoho.com/crm/developer/docs/api/v8/field-meta.html) |

The approved view covers the Central CRM reporting population. An all-Philippines total including dealer-created leads needs a separately approved scope. Product Line reporting requires a verified classification.

## Controlled production reconciliation on User’s Home

Use the [README procedure](../README.md#controlled-validation-on-tvs-asean-production) to check permissions and placement, back up the installed ZIP, and open the existing widget on your personal Home.

1. Confirm the production view ID and the exact three criteria above in TVS ASEAN India. Check membership for selected, unselected and blank dealer-created values where applicable. Confirm that the view includes older and unassigned records when those records meet the criteria and are visible to your account.
2. Confirm that the record API strings match the supplied picklist labels. Verify the lookup shape, checkboxes, and offset-bearing datetimes. [Layouts](https://www.zoho.com/crm/developer/docs/api/v8/layouts-meta.html) · [Fields](https://www.zoho.com/crm/developer/docs/api/v8/field-meta.html) · [Picklists](https://www.zoho.com/crm/developer/docs/api/v8/picklist-values.html)
3. Verify Leads read access, view visibility, field permissions, API access and record sharing for your own test account. Confirm the SDK handshake, page continuity when the view has more than one page, and Lead detail navigation. Reconcile against the view using the same Manila clock and intake period. Repeat with a recorded Lead Source and with **Not recorded** if present. Empty and permission errors are covered by simulated tests. Avoid changing permissions or view criteria to manufacture test conditions in production.
4. Check a lead in Central Review, one assigned lead awaiting its first dealer update, a Contacted lead with an elapsed SLA and a future next action, an Interested lead with no next date, a Closed lead, and a Sale Reported lead with and without the Sale Verification flag. Reconcile stages against the total for the view.
5. Confirm first dealer update semantics before publishing a first-contact success or SLA attainment rate. Verify the Central CRM sale-verification rules before using a verified-sale measure. Shared placement or rollout is outside this personal Home test.
