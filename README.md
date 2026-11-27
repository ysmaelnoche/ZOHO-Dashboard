# TVS Philippines CRM Dashboard

Daily Operations uses the approved [Handoff Board](design-exploration/concept-02.html). Executive Overview provides the management scorecard, dealer comparison, current stages and activity trends. Each release ZIP contains one dashboard and reads the same approved Central CRM view. Use `/widget.html` as the Zoho **Index Page** for both widgets.

## Local development

Use Node.js 20.20.2 or newer, npm, and Git. The browser test uses Microsoft Edge or the Chromium executable specified by `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

```sh
npm ci
npm run dev
```

Open [the local widget](http://127.0.0.1:5000/app/widget.html). This development preview lets you switch between both views and displays **DEMO DATA** without Zoho login. Rebuild with `npm run build` after editing TypeScript and then reload. Stop the server with Ctrl+C.

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript and copy the pinned chart and font assets into the widget |
| `npm run typecheck` | Check types without emitting assets |
| `npm test` | Test calculations, scoped pagination, standalone Edge and simulated SDK startup |
| `npm run validate` | Build and validate both standalone editions with ZET |
| `npm run pack` | Validate and produce `dist/TVS-PH-Daily-Operations.zip` and `dist/TVS-PH-Executive-Overview.zip` |

The ZET wrapper stores CLI state in the ignored `.zet-state/` directory. ZET 1.0.30 expects `dependencies.portfinder` for `run`; the project pins it in the lockfile. The setup audit found advisories in the ZET development dependency tree. The widget ZIP carries the generated app, Chart.js, Manrope font files, and the applicable licenses. Charts and fonts load from the widget package. [Chart.js integration](https://www.chartjs.org/docs/latest/getting-started/integration.html) · [Manrope license](https://fontsource.org/fonts/manrope/use)

## Mobile web layout

The Handoff Board stacks its lanes on narrow screens. Filters and primary controls have 44-pixel minimum touch targets, and wide tables scroll within their sections. Browser tests cover widths from 320 to 1440 pixels and an embedded 320-pixel touch viewport. Include target devices in the personal Home validation.

The TVS Zoho setup screen shows a **Mobile Compatibility** switch for this Home Page Dashboard widget. Zoho's published compatibility list omits that type. Opening an approved embedded installation on a target device starts a read automatically. [Zoho widget mobile compatibility](https://www.zoho.com/crm/developer/docs/widgets/mobile-compatibility.html)

## Controlled validation on TVS ASEAN production

### Verify access before uploading

1. Sign in with your normal test account in TVS ASEAN India, organization `60066505135`. Open **Leads → PH - Central CRM Leads**. Confirm view ID `1234527000030478107`, the approved criteria, and that you can open a Lead from the view. The reported population is your visible records in that view.
2. In **Setup → Security Control → Profiles**, have your administrator inspect your existing profile for **Leads → View** and **Zoho CRM API Access**. In **Setup → Customization → Modules and Fields → Leads → Fields → Field Permissions**, verify read visibility for the exact query fields listed in the checklist. Confirm record sharing and view visibility for that account. Stop if any required access is missing and have the administrator review it separately. The test requires read permissions only. [Profile permissions](https://help.zoho.com/portal/en/kb/crm/security-control/profile-management/articles/manage-profile-permissions) · [Field permissions](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-fields/articles/fields-list-page) · [Query field list and approved criteria](docs/CRM_METADATA_CHECKLIST.md)
3. Confirm the widget is used only on your **User’s Home** view. Updating its definition affects any existing placement, so stop if another placement exists or you cannot confirm the widget is personal-only. Keep shared, role and profile Home pages outside this test. The widget cannot verify which Home view hosts it. [Home view types and placement](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-home-tabs/articles/customize-home-tab)

### Install the standalone widgets

1. Download the currently installed widget ZIP from **Setup → Developer Hub → Widgets** as a backup. Replace the existing Daily Operations widget’s file with `dist/TVS-PH-Daily-Operations.zip`. Upload `dist/TVS-PH-Executive-Overview.zip` to a separate Home Page Dashboard widget when ready. For both use Zoho hosting and **Index Page** `/widget.html`. [Zoho widget upload and download](https://www.zoho.com/crm/developer/docs/widgets/usage.html)
2. Open each widget on your **User’s Home** for validation. Each **LIVE · READ ONLY** widget reads the approved view automatically and shows its own loading skeleton. **Refresh** re-reads the view.
3. Compare the unfiltered loaded total with the approved view in the same account. Verify that the **Why leads need attention** rows add up to **Needs attention**, then select a reason and compare its count with the work queue. Use **Find a lead** to search the current queue by name and **Open Lead in CRM** to check the matching record. Test Lead Source, older backlog, and Manila deadlines. If loading fails, use **Retry** or expand **Error details** for the operation, view, page and available Zoho error code. [Reconciliation checklist](docs/CRM_METADATA_CHECKLIST.md)
4. In the Executive Overview widget, compare the two stage totals with the visible lead count. Reconcile one dealer contact using both **All dates** and **Created in reporting period**. Verify period activity against the first-update and latest follow-up timestamps. Compare a chart tooltip with the exact values under **Activity by date**. [Executive measure definitions](docs/ARCHITECTURE.md#executive-overview-measures)

### Stop and roll back

Close Home to leave the widget, since reloading starts another read. To roll back the Daily Operations update, reupload the previously downloaded ZIP and keep **Index Page** `/widget.html`. For a newly added Executive Overview, remove its component from the test Home page.

To rebuild both widgets locally, run `npm run typecheck`, `npm test`, `npm run validate`, and `npm run pack`. [ZET commands](https://www.zoho.com/crm/developer/docs/widgets/install-cli.html)

See [architecture and metric definitions](docs/ARCHITECTURE.md) and the [original project brief](docs/PROJECT_BRIEF.md).
