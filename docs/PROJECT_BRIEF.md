# CODEX TASK — TVS Philippines CRM Custom Dashboard

## Your Role

Act as a senior full-stack engineer, Zoho CRM integration developer, and enterprise UI/UX architect.

You are developing a production-quality custom dashboard application for **TVS Motor Philippines**, integrated into the existing Zoho CRM Plus Enterprise environment.

Your responsibility in this first task is to **set up the development environment, establish the correct architecture, and deliver a working local widget scaffold**.

Do not build the full dashboard or deploy anything yet.

## 1. Project Context

Organization: TVS Motor Philippines

CRM environment:
- Platform: Zoho CRM Plus Enterprise
- Data center: India (`zoho.in`)
- CRM organization: `60066505135`
- Shared regional environment: TVS ASEAN
- Target users: Philippine Central CRM operators and management

This is a shared production CRM environment. Existing workflows, modules, layouts, dashboards, and other countries' configurations must remain untouched.

We are developing two internal dashboards:

**A. Daily Operations Dashboard**

For Central CRM operations, including lead intake, dealer assignment, follow-up monitoring, SLA exceptions, and sale verification.

**B. Executive Dashboard**

For leadership, including sales funnel performance, sources, products, dealer performance, verified sales, and operational risks.

A separate Dealer Dashboard will eventually be developed for the dealer portal. It is outside this first development phase.

## 2. Technical Architecture

Build a **custom-coded Zoho CRM Home Page Dashboard widget**.

Preferred technology:
- TypeScript
- HTML and CSS
- Lightweight frontend tooling appropriate for Zoho CRM widgets
- Official Zoho CRM JavaScript SDK
- Zoho Extension Toolkit (ZET)
- Zoho internal widget hosting

Use the official Zoho widget documentation:

https://www.zoho.com/crm/developer/docs/widgets/

https://www.zoho.com/crm/developer/docs/widgets/install-cli.html

https://www.zoho.com/crm/developer/docs/widgets/usage.html

Verify current SDK methods and CLI compatibility before implementing them. Do not invent Zoho APIs.

Avoid unnecessary dependencies or backend services.

The codebase must be maintainable, modular, and reusable for both Operations and Executive dashboards.

## 3. Development Environment Setup

Perform the following:

1. Inspect the operating system and development environment.
2. Verify Node.js, npm, Git, and necessary developer tools.
3. Install missing dependencies after obtaining any required permission.
4. Install and verify the official Zoho Extension Toolkit.
5. Initialize a Zoho CRM widget project.
6. Set up a clean project structure with appropriate separation of UI, data access, shared components, types, and configuration.
7. Initialize Git locally if appropriate. Do not push to a remote repository.
8. Create a README with development, testing, packaging, and deployment instructions.
9. Configure a local development workflow and mock-data mode.
10. Verify the application builds and runs locally.

Use ZET commands where supported:
- `zet init`
- `zet run`
- `zet validate`
- `zet pack`

Investigate any compatibility errors rather than silently replacing Zoho's recommended tooling.

## 4. Dashboard Design System

The design must be professional, minimalist, and operationally useful.

Visual direction:
- Enterprise SaaS aesthetic
- Predominantly white and neutral surfaces
- Restrained TVS branding
- High information density without visual clutter
- Clean typography and strong hierarchy
- Subtle borders and consistent spacing
- Tables and compact indicators instead of oversized cards
- Red reserved for critical operational exceptions
- Amber reserved for warnings
- Green reserved for verified success
- Responsive within a Zoho CRM widget container

Avoid:
- Gradients
- Glassmorphism
- Decorative animations
- Oversized icons
- AI-generated-looking cards
- Excessive shadows
- Meaningless charts
- Fake performance metrics
- Unnecessary illustrations

**Design principle: Every metric must inform a decision. Every alert must correspond to an actual operational issue.**

## 5. Initial Application Scaffold

Create a basic responsive application shell with:

**Header**
- TVS PH / Daily Operations
- Current view label
- Reporting-period placeholder
- Refresh control placeholder
- Last-updated indicator

**Overview**
- New Leads
- Unassigned Leads
- Overdue Follow-ups
- Pending Sale Verification

**Operational Queue**
- Priority
- Record / Issue
- Assigned owner
- Deadline
- Status
- Action

**Secondary Section**
- Lead intake trend placeholder
- Data-quality / integration status placeholder

Do not implement live CRM data retrieval yet.

Use clearly identified, synthetic mock data for local development. Do not use genuine customer names, telephone numbers, emails, or confidential CRM records.

Do not present mock metrics as genuine TVS business performance.

## 6. Integration Architecture

Create a data-access abstraction that separates the frontend from Zoho CRM.

Provide:
- Mock CRM data adapter
- Zoho CRM adapter interface
- Configuration for local development versus Zoho-embedded operation
- Data types for dashboard metrics and queues
- Error handling and empty/loading states

The Zoho CRM adapter must remain inactive until actual module and field API names are verified.

We will later connect these business areas:

- Philippine Leads
- Lead Source and Product Interest
- Central CRM dealer assignment
- PH Dealer Follow-up records
- First-contact and follow-up deadlines
- Attention-required flags
- Dealer-reported sales
- Central CRM sale verification

Field names discussed previously include `Lead_Source`, `PH_Attention_Required`, `Next_Action_Due`, and `PH_Workflow_Stage`.

Treat these as provisional references, not verified metadata.

Do not implement API queries using assumed field names.

Do not hardcode credentials, OAuth tokens, or organization-wide administrator access.

All future data access must respect authenticated CRM user permissions and Philippine record-access restrictions. Frontend filters alone are not sufficient authorization.

## 7. Security and Environment Restrictions

This is a shared ASEAN production environment.

During this first phase:

- Do not access, create, update, or delete production CRM records.
- Do not create or modify Zoho CRM widgets in the live organization.
- Do not alter existing dashboards, layouts, functions, or permissions.
- Do not deploy to production.
- Do not access Indonesian CRM data.
- Do not introduce publicly accessible URLs containing customer information.
- Do not generate or store production credentials.
- Do not perform irreversible operations.

Any action requiring CRM authorization or production changes must be documented for later approval.

## 8. Required Deliverables

Create the project files and provide:

1. A working local widget application scaffold.
2. A clean frontend design-system foundation.
3. A mock dashboard preview.
4. A data adapter structure for future Zoho integration.
5. An appropriate Zoho widget manifest and packaging configuration.
6. A README explaining installation, local development, validation, and deployment.
7. An architecture document explaining the components and integration strategy.
8. A CRM metadata checklist specifying what must be verified before live data integration.
9. A tested ZIP package if supported by the available Zoho tooling.

## 9. Acceptance Criteria

The setup phase is complete when:

- The application can run locally.
- The interface loads correctly using synthetic data.
- The Zoho widget initialization path is implemented appropriately.
- The local mock preview does not depend on a Zoho login.
- Dependencies and scripts are reproducible.
- ZET validation and packaging pass, or blockers are clearly documented.
- The code is maintainable and appropriately structured.
- No production CRM changes have occurred.

## 10. Execution Instructions

Proceed with environment inspection, project initialization, implementation, and local validation.

Do not stop at recommendations—create the working project files.

Choose practical engineering defaults without overengineering. Ask for input only if access, credentials, or a consequential decision is genuinely required.

At the end, provide:

- Project structure
- Dependencies and tools installed
- Commands executed and their outcomes
- Local preview instructions
- Validation/build results
- Issues or limitations discovered
- Exact next steps for CRM metadata verification and integration

**STOP AFTER THE LOCAL SETUP AND VALIDATION PHASE.**

Do not begin live CRM integration or production deployment without a separate instruction.

Do not use any sub-agents DIY.