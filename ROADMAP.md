This roadmap breaks down OmniShift's production engineering path into discrete, trackable tickets.

How to execute in parallel:
Assign by **lane and wave**, not by ticket ID alone. See [ROADMAP_EXECUTION.md](./ROADMAP_EXECUTION.md) for Phase 1 wave schedules, file locks, and safe 3+ agent layouts.

Stream hint: Tickets under separate streams (e.g., [Multi-Tenant Backend] vs [Owner/Admin UI]) are *often* parallel-safe, but many tickets share files or logical dependencies — follow the execution guide before claiming work.

Path note: Ticket `Files:` lines use a legacy `src/` prefix; actual paths in this repo are `app/…`, `lib/…`, `prisma/…` (no `src/`).

Phase 1 — Tenant Foundation & Access Control
Goal: Enforce the B2B owner/employee boundary, replace open self-join with owner-controlled onboarding, and harden tenant isolation before any pilot.

**Execution waves:** W1 → W6 (see [ROADMAP_EXECUTION.md](./ROADMAP_EXECUTION.md)). Tag format below: `Wave · Lane`.

[Stream: Multi-Tenant Backend]
[x] TKT-101: Restrict Public Registration

Description: Rename and re-purpose /register to purely serve Business Owner intent ("Create your workspace"). Implement an API-layer block on registration paths that attempt to create a user without an accompanying pending Invitation token or an explicit owner bootstrap payload.

Files: src/app/api/auth/register/route.ts, src/lib/auth.ts

Execution: W2 · Lane `AUTH` (with TKT-115, then TKT-111 in W3) · `lib/auth.ts` lock

[x] TKT-102: Activate Better Auth Invitation Model

Description: Implement POST /api/organization/invitations. This endpoint must be restricted to workspace owners/admins and create an invitation record tracking email, role, and expiresAt (default 7 days) tied to the active organizationId. Persist via the Better Auth organization plugin or our Prisma Invitation schema table.

Files: src/app/api/organization/invitations/route.ts, prisma/schema.prisma

Execution: W2 · Lane `INVITE-API` · schema lock · before TKT-103

[x] TKT-103: Invitation Management Endpoints (List & Revoke)

Description: Build GET /api/organization/invitations to list all pending invitations and DELETE /api/organization/invitations/[id] to allow owners to revoke an active invitation before it is claimed.

Files: src/app/api/organization/invitations/route.ts, src/app/api/organization/invitations/[id]/route.ts

Execution: W3 · Lane `INVITE-API` · after TKT-102

[x] TKT-104: Token-Gated Onboarding Pipeline

Description: Replace the open /join/{slug} route with a secure token validation flow via GET /join/invite/[token]. Server-side validate that the token exists, is pending, matches the target email, and hasn't expired before allowing account provisioning or logging in via magic link.

Files: src/app/(auth)/join/invite/[token]/page.tsx, src/lib/services/join.service.ts

Execution: W3 · Lane `JOIN` · before TKT-105, TKT-106, TKT-107

[x] TKT-105: Secondary Domain Whitelist Enforcement

Description: Enforce Organization.metadata.allowedDomains as a secondary security fallback during invitation processing and join requests. Reject the token redemption if the target email domain fails to match (emailMatchesAllowedDomains in lib/organization/metadata.ts).

Files: src/lib/organization/metadata.ts, src/lib/services/join.service.ts

Execution: W4 · Lane `JOIN` · after TKT-104

[x] TKT-106: Join-Request Queue Mechanics

Description: Implement an optional organization setting for inbound requests. POST /api/join/request creates a JoinRequest in a PENDING state instead of an immediate membership assignment. Expose POST /api/organization/join-requests/[id]/approve for manual supervisor/owner clearance.

Files: app/api/join/request/route.ts, app/api/organization/join-requests/[id]/approve/route.ts, lib/services/join-request.service.ts, prisma/schema.prisma

Execution: W4 · Lane `JOIN` · schema lock if JoinRequest table needed · before TKT-107

[x] TKT-107: De-authorize Implicit Domain Membership

Description: Refactor completeOrganizationJoin inside join.service.ts to explicitly require a verified invitation record or approved join-request row. Completely eliminate legacy paths that grant a Member row using a domain match alone.

Files: src/lib/services/join.service.ts

Execution: W4 · Lane `JOIN` · after TKT-104/105/106

[x] TKT-108: Multi-Tenant Prisma Query Sweep & Audit

Description: Enforce that service layers ingest organizationId strictly from a validated session wrapper (lib/security/session-context.ts). Perform an exhaustive audit across time-tracking.service.ts, admin-dashboard.service.ts, and join.service.ts to eliminate raw, un-scoped queries.

Files: src/lib/services/time-tracking.service.ts, src/lib/services/admin-dashboard.service.ts, src/lib/security/session-context.ts

Execution: W5 · Lane `TENANT-SWEEP` · before TKT-109 or same agent

[x] TKT-109: Prevent Double Clock-In Concurrency

Description: Add a partial unique index on time_log (user_id, organization_id) WHERE end_time IS NULL at the database layer. Wrap state mutations (clock-in, clock-out, status swaps) inside explicit Prisma transactional rollbacks to completely eliminate concurrent duplicate open shifts per tenant.

Files: prisma/schema.prisma, src/lib/services/time-tracking.service.ts

Execution: W5–W6 · Lane `CLOCK` · schema lock · after TKT-108

[x] TKT-110: Environment Bootstrapping Guard

Description: Introduce a strict, Zod-validated configuration file lib/env.ts that runs at startup. Crash the Next.js process immediately during initialization if vital environment strings are missing (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL).

Files: src/lib/env.ts, src/app/layout.tsx

Execution: W1 · Lane `ENV`

[x] TKT-111: Email Microservice Hookup

Description: Replace console email logging stubs inside lib/auth.ts (sendMagicLink) with a true transactional mail provider delivery pattern (Resend / Postmark / SendGrid). Draft and style clean, operational HTML templates for organizational invitations.

Files: src/lib/auth.ts, src/lib/email/templates.ts

Execution: W3 · Lane `AUTH` · after TKT-101/115

[Stream: Owner/Admin UI]
[x] TKT-112: Owner Workspace Command Center (/admin/team)

Description: Design the central TeamInviteDashboard.tsx view. Integrate email invitation controls (supporting single entries and bulk CSV uploads), a table of outstanding pending invitations, a real-time seat tracking indicator, and an inline allowed-domains text editor.

Files: src/app/(dashboard)/admin/team/page.tsx, src/app/(dashboard)/admin/team/_components/TeamInviteDashboard.tsx

Execution: W4 · Lane `TEAM-UI` · after TKT-102/103 · before TKT-113/114

[x] TKT-113: Refactor Invitation Discovery Layout

Description: Remove all public "share link" UX components that suggest an un-throttled self-join workflow. Replace them with an explicit, high-visibility "Invite Employees" workflow containing copyable onboarding guidelines meant for team IT leads.

Files: src/app/(dashboard)/admin/team/_components/InviteModal.tsx

Execution: W5 · Lane `TEAM-UI` · after TKT-112

[x] TKT-114: Join Request & Pending Invites Control Panel

Description: Introduce interactive sub-tabs for Pending Invitations and Active Join Requests. Build approve/deny action triggers backed by confirmation modals containing transaction auditing notices.

Files: src/app/(dashboard)/admin/team/_components/RequestsTable.tsx

Execution: W5 · Lane `TEAM-UI` · after TKT-112/113 · needs TKT-106

[x] TKT-115: Restrict Initial Google OAuth Self-Signup

Description: Reconfigure Google OAuth behaviors on the authentication page. For returning profiles, allow seamless single sign-on. For un-provisioned employee identities, block independent workspace generation; force access paths through an active token redemption link.

Files: src/app/(auth)/login/page.tsx, src/lib/auth.ts

Execution: W2 · Lane `AUTH` · bundle with TKT-101 · before TKT-111

[x] TKT-116: Owner Multi-Step Workspace Setup

Description: Assemble an onboarding wizard (/register → /onboarding). Explicitly warn the user that they are establishing a commercial workspace. Collect the formal corporate legal name, primary operational timezone selection, and seed the initial domain restriction values.

Files: src/app/(auth)/onboarding/page.tsx

Execution: W2 · Lane `ONBOARD-UI`

[x] TKT-117: Admin Role Guard and Navigation Split

Description: Update layout middleware checks in app/(dashboard)/admin/layout.tsx. If an authenticated account contains standard member properties, auto-route them directly to /employee/track. Reserve access to the floor monitor, raw analytics tables, and administrative screens exclusively for owner and admin roles.

Files: src/app/(dashboard)/admin/layout.tsx

Execution: W1 · Lane `ACCESS-UI`

[x] TKT-118: Global Tenant Config Screen (/admin/settings)

Description: Create the core operational workspace options dashboard. Allow real-time mutations of the organization's display name, operational timezone baseline, allowed-domains list, and toggle settings for join validation policies.

Files: src/app/(dashboard)/admin/settings/page.tsx

Execution: W4 · Lane `SETTINGS-UI`

[Stream: Security & Compliance]
[x] TKT-119: Cross-Tenant Isolation Integration Tests

Description: Author a robust suite of isolated backend testing sequences. Confirm that an active auth session from Tenant A receives an immediate rejection payload upon attempting reads, writes, mutations, or administrative updates against Tenant B structures across every single endpoint route.

Files: src/tests/integration/tenant-isolation.test.ts

Execution: W6 · Lane `ISOLATION-TEST` · after all Phase 1 APIs

[x] TKT-120: Specialized Authentication Rate Limiting

Description: Extend the existing security logic in lib/security/join-rate-limit.ts to intercept and regulate requests targeting invite generation, inbound join-queue requests, and magic-link dispatches. Apply restrictions on both remote IP pools and individual target email targets.

Files: src/lib/security/join-rate-limit.ts

Execution: W5 · Lane `RATE-LIMIT` · after TKT-102/106 invite & join routes

[x] TKT-121: Security Core Audit Logging Engine

Description: Wire up database logging events targeting an append-only AuditLog table. Ensure that system mutations (invitation.sent, invitation.accepted, join_request.approved, member.role_changed, domain_whitelist.updated) immediately write structural records tracking actors, target changes, and timestamp profiles.

Files: src/lib/db/audit.ts

Execution: W2–W3 · Lane `AUDIT-ENGINE` · schema lock · coordinate with INVITE-API

[x] TKT-122: Edge Proxy Session Verification Refactor

Description: Upgrade the current session interceptor checks. Transition from standard, shallow cookie confirmation to deeper validation, adding an optimized server layout verification step protecting paths downstream of the /admin/* tree.

Files: src/middleware.ts, src/lib/security/proxy.ts

Execution: W1 · Lane `EDGE-SEC`

[x] TKT-123: Sandbox Environment Flag Isolation

Description: Enforce strict production gatekeeping parameters around experimental routes. Completely block access to /developer/sandbox unless the underlying target runtime explicitly reports NODE_ENV !== 'production' or ENABLE_DEV_SANDBOX=true.

Files: src/app/developer/sandbox/page.tsx

Execution: W1 · Lane `SANDBOX`

[x] TKT-124: Automated Multi-Tenant CI Setup

Description: Build and test real-world database behaviors directly inside your build pipelines. Integrate a structured testing container deployment routine into .github/workflows/ci.yml via docker-compose.test.yml, specifically targeting concurrent workspace join race-conditions.

Files: .github/workflows/ci.yml, docker-compose.test.yml

Execution: W1 · Lane `CI`

Phase 2 — Owner Workspace & Operational Reliability
Goal: Give the paying owner a trustworthy command center — live floor, accurate timesheets, member lifecycle, and audit trail — scoped entirely to their organization.

[Stream: Multi-Tenant Backend]
[ ] TKT-201: Structural Timezone Schema Migrations

Description: Introduce timezone (string tracking standard IANA locations) and joinPolicy configurations to the Organization core Postgres database structure. Ship a production-safe data patch to assign fallback system baseline preferences cleanly across existing items.

Files: prisma/schema.prisma, prisma/migrations/

[ ] TKT-202: Multi-Timezone Analytics Calculation Layer

Description: Refactor backend calculation engines (resolveDateRange, getMyDayService, getAdminOverviewService, getTimesheetsService). Ensure that organizational midnight boundaries and summary buckets compute relative to the client company's local timezone configuration, while storing absolute tracking moments in database-level timestamptz.

Files: src/lib/services/admin-dashboard.service.ts, src/lib/utils/date-helpers.ts

[ ] TKT-203: Agent Deactivation Lifecycle

Description: Deploy PATCH /api/organization/members/[memberId]/status. Rather than deleting user history, implement soft deactivation states (active vs deactivated). Block deactivated accounts from subsequent shift actions and omit them from current active floor summaries.

Files: src/app/api/organization/members/[memberId]/status/route.ts

[ ] TKT-204: Transaction-Audited Timesheet Corrections

Description: Establish PATCH /api/admin/timesheets/[timeLogId]. Require supervisors to pass a structured text validation reason. Write all original values and targeted adjustments into a system-protected TimeLogAudit log table.

Files: src/app/api/admin/timesheets/[timeLogId]/route.ts

[ ] TKT-205: Tenant Customizable Activity States

Description: Deliver complete CRUD API patterns under /api/organization/activity-statuses. Allow managers to customize their system's tracking options, while blocking modifications to states tied to active, open timecard events.

Files: src/app/api/organization/activity-statuses/route.ts

[ ] TKT-206: Compliance Alert Rules Processing Engine

Description: Introduce configurable tracking limits inside the workspace metadata dictionary (defining operational bounds for maximum continuous shifts, regular breaks, and lunch breaks). Read these boundaries directly to flag overages within admin-dashboard.service.ts.

Files: src/lib/services/admin-dashboard.service.ts

[ ] TKT-207: Automated End-Of-Day Cron Job

Description: Deploy a secure background execution path (/api/cron/auto-clock-out) protected by a CRON_SECRET header check. Automatically cap broken, runaway employee shifts exceeding organization thresholds and mark the record with an automated system alert note.

Files: src/app/api/cron/auto-clock-out/route.ts

[ ] TKT-208: Active Connection Heartbeat Pipeline

Description: Build out an endpoint for tracking live presence: POST /api/time/heartbeat. Update a lastSeenAt field on the tenant membership record every 60 seconds to detect network drops or dropped agent tabs across the real-time grid view.

Files: src/app/api/time/heartbeat/route.ts

[ ] TKT-209: Network Failure Idempotency Tokens

Description: Incorporate strict request deduplication tokens across state changes (clock-in, clock-out, status). Prevent network retry loops or double-clicks from corrupting an agent's historical tracking history.

Files: src/app/api/time/clock-in/route.ts

[ ] TKT-210: High-Density SQL Performance Tuning

Description: Optimize database interactions inside getAdminOverviewService. Tune execution performance to handle over 100 concurrent floor profiles per tenant using precise PostgreSQL lateral joins to fetch the latest tracking event for each user in a single database round-trip.

Files: src/lib/services/admin-dashboard.service.ts

[Stream: Owner/Admin UI]
[ ] TKT-211: Enterprise Floor Monitor Interface Enhancements

Description: Accelerate user updates within AdminOverviewDashboard.tsx via optimized 5-second fallback poll rates. Lay the foundations for an SSE (Server-Sent Events) live data streaming fallback layer and include color-coded alerts for agents exceeding compliance thresholds.

Files: src/app/(dashboard)/admin/monitor/page.tsx, src/app/api/admin/overview/stream/route.ts

[ ] TKT-212: Real-Time Operational KPI Dashboard Cards

Description: Build out a scannable summary header displaying vital real-time operations info (such as Total Scheduled, Total Available, On Break, Absent, and Adherence summaries), isolating the calculations strictly to current active workspace members.

Files: src/app/(dashboard)/admin/monitor/_components/KPIHeader.tsx

[ ] TKT-213: Advanced Analytics Reporting Interface

Description: Update AdminReportsDashboard.tsx. Integrate an organization-timezone sensitive date selector, direct agent lookup filters, and a single-click CSV exporter that flags manually edited shifts.

Files: src/app/(dashboard)/admin/reports/page.tsx

[ ] TKT-214: Historical Corrections Portal

Description: Build a management popup window allowing managers to tweak historical tracking values. Force confirmation of an explicit text justification, and display a scannable, read-only log table of the item's previous edits.

Files: src/app/(dashboard)/admin/reports/_components/CorrectionModal.tsx

[ ] TKT-215: Operational State Customizer UI

Description: Build out /admin/settings/statuses. Provide administrators a visual utility dashboard to manage trackable employee statuses, configure interface display colors, and flag whether a status counts as a paid break or billable downtime.

Files: src/app/(dashboard)/admin/settings/statuses/page.tsx

[ ] TKT-216: Management Security Suspension Controls

Description: Integrate interactive account suspend and reactivate buttons on the team page. Ensure that updating an account instantly invalidates the target profile's application session token, blocking downstream API interactions on the next request.

Files: src/app/(dashboard)/admin/team/_components/MemberRowActions.tsx

[ ] TKT-217: Workspace Audit Trail Viewer

Description: Add a compliance logs dashboard at /admin/settings/audit. Build out a fast, searchable grid component that lets managers review security updates, profile configuration adjustments, and user state modifications across the workspace.

Files: src/app/(dashboard)/admin/settings/audit/page.tsx

[ ] TKT-218: Resilient Offline Employee Interface

Description: Refactor /employee/track and useTimeTracking.ts to improve network resilience. Introduce an offline indicator banner and an optimistic state execution queue that caches actions locally and automatically retries sync requests when internet connectivity drops.

Files: src/app/(dashboard)/employee/track/page.tsx, src/lib/hooks/useTimeTracking.ts

[Stream: Security & Compliance]
[ ] TKT-219: Standardized Multi-Tenant Structured Log Matrix

Description: Inject structured JSON pipeline outputs within lib/http/api-handler.ts. Enforce that every transaction records unique execution indicators including requestId, verified organizationId, active userId, user role, path, processing duration, and response code.

Files: src/lib/http/api-handler.ts

[ ] TKT-220: Tenant-Tagged Application Error Monitoring

Description: Configure your Sentry error reporting client to pass multi-tenant tracking keys. Automatically attach metadata identifying organizationId and organizationSlug to both client and server errors to streamline platform debugging.

Files: sentry.server.config.ts, sentry.client.config.ts

[ ] TKT-221: Infrastructure Load Balancer Healthcheck Endpoints

Description: Introduce an un-throttled public endpoint /api/health that returns standard system wellness metrics. Ensure the service performs a quick database responsiveness test before providing an HTTP 200 success response.

Files: src/app/api/health/route.ts

[ ] TKT-222: Production Edge Security Header Layer

Description: Enforce strict production browser headers within next.config.ts. Lock down application security parameters by configuring high-grade Content Security Policies (CSP), X-Frame-Options framing blocks, and standard explicit Referrer-Policy properties.

Files: next.config.ts

[ ] TKT-223: Multi-Tenant Workspace Compliance Export Utilities

Description: Build out /api/admin/export to handle data retention exports. Provide an workspace owner a single-click archive process that packages team profiles, all historical shifts, and audit table entries into a clean zip payload isolated to their workspace.

Files: src/app/api/admin/export/route.ts

[ ] TKT-224: Automated Concurrency Scalability Runs

Description: Write k6 automated load testing scripts designed to mimic heavy operational conditions. Stress test backend routers against spikes of over 100 simultaneous agent check-ins to catch data locks before shipping.

Files: loadtests/simultaneous-clockin.js

Phase 3 — Monetization, Scale & Advanced Operations
Goal: Seat-based revenue, supervisor delegation, and call-center depth features — all tenant-scoped under the owner's subscription.

[Stream: Multi-Tenant Backend]
[ ] TKT-301: Stripe B2B Subscription Engine Integration

Description: Connect Stripe multi-tenant billing models. Associate billing profiles directly to each Organization, map subscription tiers directly to active user limits, and build a webhook handler to update subscriptionStatus properties.

Files: src/app/api/billing/webhook/route.ts, src/lib/billing/stripe.ts

[ ] TKT-302: Active Seat Limit Enforcement Middleware

Description: Build real-time user validation checks into your user creation pipeline. Block user registration or invitation claims if the sum of active seats and pending invitations hits the workspace's plan maximum, returning an explicit SEAT_LIMIT_REACHED error code.

Files: src/lib/services/organization-team.service.ts

[ ] TKT-303: Middle Management Supervisor Access Scopes

Description: Introduce a new supervisor user level inside lib/organization/roles.ts. Grant supervisors full access to view live monitoring grids and historical reporting tables, while blocking access to billing settings, domain rules, or team access management permissions.

Files: src/lib/organization/roles.ts

[ ] TKT-304: Shift Schedule Management Core Engine

Description: Add data tables for schedules (Schedule, ScheduleAssignment) to the database. Build out backend compliance engines that cross-reference scheduled shifts against actual logged hours to calculate real-time adherence scores.

Files: prisma/schema.prisma, src/lib/services/schedule.service.ts

[ ] TKT-305: Internal Team Taxonomy Structures

Description: Update data models to support multiple sub-teams inside a single workspace (Team containing a structural Member.teamId relational pointer). Refactor monitoring APIs to let managers filter dashboards by specific sub-teams.

Files: prisma/schema.prisma, src/lib/services/admin-dashboard.service.ts

[ ] TKT-306: Outbound Tenant Event Webhook Dispatches

Description: Build out an event messaging system. Broadcast cryptographic, signature-signed payloads out to registered URLs on important event changes (clock.in, clock.out, status.change, compliance.alert). Include an automatic queue manager to handle failed message retries.

Files: src/lib/services/webhook-dispatcher.service.ts

[ ] TKT-307: External ACD Dialer Integration Route

Description: Introduce a high-performance endpoint (/api/integrations/acd/status) to sync agent states with external phone system platforms (like Twilio, Genesys, or ViciDial), authenticating requests via secure, organization-managed API keys.

Files: src/app/api/integrations/acd/status/route.ts

[ ] TKT-308: Multi-Tenant Performance Aggregation Computations

Description: Write an automated, scheduled batch data aggregation task. Compile granular employee tracking lines nightly into optimized reporting summaries (occupancy, adherence percentages) to keep historical metrics fast as data grows.

Files: src/lib/cron/nightly-rollups.ts

[ ] TKT-309: Multi-Instance Read-Replica Database Routing

Description: Enhance database performance by configuring separate connection routing. Send heavy, long-range historical data lookups and reporting queries to read replicas, reserving your primary database instance for fast, time-critical status writes.

Files: src/lib/db/prisma-client.ts

[ ] TKT-310: Redis Distributed Active Floor Cache Distributed System

Description: Deploy a low-latency caching solution using Redis. Cache real-time floor monitoring snapshots by organizationId, and automatically invalidate cache keys whenever an agent writes a new status change.

Files: src/lib/cache/redis.ts, src/lib/services/admin-dashboard.service.ts

[Stream: Owner/Admin UI]
[ ] TKT-311: Commercial Billing Customer Portal Interface

Description: Design the billing hub at /admin/billing. Display current plan details, active seat capacity limits, and upcoming invoices. Integrate a direct link that opens a secure Stripe Customer Self-Service Portal session.

Files: src/app/(dashboard)/admin/billing/page.tsx

[ ] TKT-312: Team Management Seat Capacity Counters

Description: Embed an intuitive seat tracking status bar directly on the team management screen (e.g., "12 out of 15 slots active"). Provide explicit actions that allow administrators to scale up seat counts instantly.

Files: src/app/(dashboard)/admin/team/_components/SeatUsageWidget.tsx

[ ] TKT-313: Dynamic Operational Scheduling Editor UI

Description: Build a drag-and-drop team calendar dashboard view. Let managers organize weekly shifts, duplicate schedule structures across weeks, and view real-time adherence indicators directly on live tracking views.

Files: src/app/(dashboard)/admin/schedules/page.tsx

[ ] TKT-314: Middle Management Navigation Layout Variations

Description: Adjust navigation layout visibility rules for supervisors. Hide billing controls, security logs, and integration menus from the layout sidebar when a user logs in with a supervisor role.

Files: src/app/(dashboard)/admin/_components/SidebarNav.tsx

[ ] TKT-315: Large-Screen Call Center Wallboard Interface (/admin/overview/display)

Description: Design a clean, high-visibility "Wallboard Mode" dashboard view optimized for physical TVs. Protect access via long-lived, secure browser tokens and use high-contrast layouts readable from across the office floor.

Files: src/app/(dashboard)/admin/overview/display/page.tsx

[ ] TKT-316: Interactive Management Workspace Onboarding Portal

Description: Design an actionable onboarding wizard on the main /admin dashboard. Guide new company accounts through setting up domain rules, configuring custom tracking states, inviting their staff, and setting up their billing profile.

Files: src/app/(dashboard)/admin/page.tsx

[ ] TKT-317: Individual Personal Shift History View

Description: Create a personal history page at /employee/history. Provide standard agents a clean, read-only list of their own historical timecard entries while strictly blocking access to other employees' information.

Files: src/app/(dashboard)/employee/history/page.tsx

[Stream: Security & Compliance]
[ ] TKT-318: Comprehensive Multi-Tenant Security Verification Checks

Description: Conduct an exhaustive internal security code review. Create and run explicit verification checks to ensure URL parameter inputs cannot be manipulated to access cross-tenant information (memberId, timeLogId, invitationId).

Files: src/tests/security/idor-compliance.test.ts

[ ] TKT-319: SOC 2 Compliant Access Control Records

Description: Document the platform's security design patterns to support compliance tracking. Create a data dictionary detailing data encryption methods, system permission matrices, and automated log retention behaviors.

Files: docs/compliance/soc2-matrix.md

[ ] TKT-320: High-Performance Distributed Task Architecture

Description: Offload heavy background operations from the main application thread. Move heavy crons, data calculations, and webhook retries out to an isolated queue manager (like Inngest, BullMQ, or Trigger.dev).

Files: src/lib/workers/

[ ] TKT-321: Tenant-Isolated Rollout Configuration Flags

Description: Deploy dynamic feature flags mapped within the tenant metadata schema. Allow engineers to safely roll out new operational features or experiment paths to select workspaces before a global release.

Files: src/lib/features/flags.ts

[ ] TKT-322: Infrastructure Availability Status Monitoring Page

Description: Establish a public service health status page. Display platform uptime performance metrics and track processing latency goals (aiming for 99.9% availability targets).

Files: src/app/status/page.tsx

[ ] TKT-323: Automated Tenant Archive Compliance Routines

Description: Build automated data backup tools. Allow company owners to request data exports, and run automated cron scripts that package and compress old audit histories into encrypted compliance archives.

Files: src/lib/cron/backup-archiver.ts