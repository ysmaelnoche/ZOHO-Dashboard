# TVS Philippines CRM Dashboard

Local scaffold for the Daily Operations widget. The preview displays synthetic Philippine CRM scenarios. Refresh reloads the sample snapshot and Review shows a suggested next action for the selected sample issue.

## Development

Use Node.js 20.20.2 or newer, npm and Git. Node 20.20.2, npm 10.8.2 and Git 2.55.0.windows.3 were used on Windows. The smoke test uses Microsoft Edge, or a Chromium executable supplied through `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

```sh
npm ci
npm run dev
```

Open [the local preview](http://127.0.0.1:5000/app/widget.html). This is a loopback HTTP server behind `zet run` and requires no Zoho login. Rebuild with `npm run build` after editing TypeScript, then reload the page. Stop the server with Ctrl+C.

| Command | Purpose |
| --- | --- |
| `npm run build` | Compile TypeScript into `app/js/` |
| `npm run typecheck` | Check types without emitting assets |
| `npm test` | Build and run the isolated Chromium smoke test |
| `npm run validate` | Build and run `zet validate` |
| `npm run pack` | Build and run `zet pack` into `dist/<checkout-folder>.zip` |

The ZET wrapper stores CLI state in the gitignored `.zet-state/` directory. ZET 1.0.30 expects `dependencies.portfinder` for its `run` command and tries to install it automatically if absent. It is pinned in the lockfile and unused by the browser. The original `zet init --zoho-service CRM --project-name tvs_widget_template` generated a CRM manifest and a sample app. Its automatic install hit a Windows sandbox spawn restriction, so dependencies were installed through the project's npm workflow.

The setup audit reported seven moderate and one high finding in the ZET development dependency tree. These packages are outside the widget ZIP. Review upstream advisories and rerun `npm audit` when upgrading the toolkit.

## Packaging and future deployment

The generated CRM manifest declares `"service": "CRM"` at the repository root. ZET uses it during validation and places the entry at `app/widget.html` in the CRM ZIP. The local server exposes the same entry under `/app/widget.html`. Zoho documents a 25 MB ZIP limit. [Installing ZET](https://www.zoho.com/crm/developer/docs/widgets/install-cli.html) · [Working with widgets](https://www.zoho.com/crm/developer/docs/widgets/usage.html)

With separate authorization, use a PH-scoped sandbox to verify Developer Hub → Widgets. Select the Dashboard widget type and Zoho hosting, upload the ZIP and configure Index URL to resolve to the packaged `app/widget.html` entry under the generated hosting base. Confirm the resulting URL in the sandbox. Verify direct placement under Home → Add Component → Widgets and record the required role/profile and publishing settings before requesting any production change. [Zoho Home tab documentation](https://help.zoho.com/portal/en/kb/crm/customize-crm-account/customizing-home-tabs/articles/customize-home-tab)

See [architecture](docs/ARCHITECTURE.md), [CRM metadata checklist](docs/CRM_METADATA_CHECKLIST.md) and [original project brief](docs/PROJECT_BRIEF.md).
