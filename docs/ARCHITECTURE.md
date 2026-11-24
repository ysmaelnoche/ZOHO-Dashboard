# Widget architecture

## Hosting and placement

The application is an internally hosted Zoho CRM Home Page Dashboard widget. Zoho documents direct placement under Home → Add Component → Widgets. Canvas is a fallback container only if required by the target organization's Home configuration. The actual TVS ASEAN placement, access and SDK handshake require an authorized sandbox check. [Widget overview](https://www.zoho.com/crm/developer/docs/widgets/) · [Home tab placement](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-home-tabs/articles/customize-home-tab)

ZET generated `plugin-manifest.json` with the CRM service and an `app/widget.html` entry. The official CRM packer excludes the root manifest and includes the static browser files. The repository's loopback-only server replaces the generated HTTPS server and its sample key/certificate for login-free preview. Zoho's documented CRM-context local test uses External Hosting and HTTPS. This scaffold uses the internal ZIP in a future authorized sandbox instead. [Create a widget](https://www.zoho.com/crm/developer/docs/widgets/create-widget.html) · [ZET commands](https://www.zoho.com/crm/developer/docs/widgets/install-cli.html)

## Components and runtime

| Location | Responsibility |
| --- | --- |
| `app/widget.html` and `app/styles/` | Semantic widget shell and shared visual tokens |
| `src/ui/` | Typed rendering for the overview, queue, review dialog and summaries |
| `src/data/dashboard.ts` | View models and the adapter contract |
| `src/data/mock.ts` | Synthetic intake and queue data with derived KPI counts |
| `src/config.ts` and `src/main.ts` | Startup mode, refresh, and loading and error messages |
| `src/zoho.ts` | Official SDK loader and initialization with a timeout |
| `server/`, `scripts/`, `tests/` | Loopback preview, project-local ZET commands and browser smoke test |

Standalone loopback pages select the mock adapter and make no external requests. A non-loopback iframe selects the embedded startup path, which loads Zoho's SDK v1.4 and calls `ZOHO.embeddedApp.init()`. `PageLoad` is documented for record-detail context, so startup does not wait for that event on Home. SDK errors produce a status message. After SDK initialization the embedded widget still indicates that live data is disabled. Iframe detection selects startup behavior and grants no data access. [Widget lifecycle](https://www.zoho.com/crm/developer/docs/widgets/create-widget.html) · [SDK v1.4](https://www.zohocrm.dev/explore/widgets/v1.4/changelogs)

The future Zoho adapter implements the data contract and maps verified CRM fields into the screen's view models. Keep query and mapping code outside rendering. Use authenticated CRM permissions, field-level security and record-sharing rules as the access boundary. Verify that the selected SDK query mechanism preserves those controls for records, totals and lookups before implementing any production read. The executive dashboard can reuse the runtime and UI conventions and define its own view model.
