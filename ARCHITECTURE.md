# Architecture — OmniShift

**OmniShift** is call-center time tracking built as a full-stack **Next.js** app with **Better Auth**, **Prisma**, and **PostgreSQL**. Employees clock in and switch activity statuses; admins monitor the floor in real time, export timesheets, and share a self-serve team join link.

Brand constants live in `lib/constants/brand.ts` (`BRAND_NAME`, `BRAND_TAGLINE`, `brandPageTitle()`).

Use this document to navigate the repo when something breaks: start at the **symptom layer** (UI → API → service → DB/auth).

---

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19 |
| Auth | Better Auth (`emailAndPassword`, `magicLink`, `organization` plugins) |
| Database | PostgreSQL via Prisma |
| Styling | Tailwind CSS 4, shadcn/ui-style components |
| Validation | Zod |

---

## High-level flow

```
Browser (pages/components)
    ↓ fetch + cookies
app/api/*  +  app/api/auth/*  (Better Auth)
    ↓
lib/http/session-route.ts  (auth guards)
    ↓
lib/services/*  (business logic)
    ↓
Prisma  →  PostgreSQL
```

### User roles

| Role | Typical paths |
|------|----------------|
| **Owner / Admin** | `/admin/overview`, `/admin/reports`, `/admin/team` |
| **Member (agent)** | `/employee/track` |
| **New owner** | `/register` → `/onboarding` → `/admin/overview` |
| **New employee** | `/join/{orgSlug}` (magic link, no password) |

---

## Request guards

### Edge middleware — `middleware.ts`

Protects routes that require a session cookie:

- `/employee/*`
- `/admin/*`
- `/onboarding`
- `/billing/*`

Unauthenticated users are redirected to `/login?next=...`.

**Not protected (public):** `/login`, `/register`, `/join/*`.

### API guards — `lib/http/session-route.ts`

| Helper | Who can call |
|--------|----------------|
| `executeAuthenticatedRoute` | Any logged-in member of the active organization |
| `executeAdminRoute` | `owner` or `admin` role only |

Session context is resolved in `lib/security/session-context.ts` from the Better Auth session cookie and `activeOrganizationId`.

---

## User journeys

### Owner first-time setup

```
/register
  → components/signup-form.tsx (password signup via authClient.signUp.email)
/onboarding
  → components/onboarding-form.tsx (Better Auth organization.create)
  → POST /api/organization/bootstrap
       → seed default activity statuses
       → initialize join metadata (allowedDomains from owner email)
  → /admin/overview
```

Billing (`/billing/checkout`) is a placeholder and is **not** part of the onboarding path today.

### Employee self-serve join

```
/join/{orgSlug}
  → components/join/JoinForm.tsx
  → POST /api/join/request-magic-link
       → lib/services/join.service.ts (domain check against org metadata)
       → auth.api.signInMagicLink (Better Auth; creates user if new)
User clicks magic link
  → GET /api/auth/.../magic-link/verify (Better Auth)
  → /join/{orgSlug}/complete
       → join.service completeOrganizationJoin (Prisma member row)
       → auth.api.setActiveOrganization
/employee/track
```

Org isolation: the organization is always resolved from **`orgSlug` in the URL** on the server, never from client-supplied `organizationId` alone.

### Employee workday

```
/employee/track
  → components/employee/TimeCardDashboard.tsx
  → hooks/useTimeTracking.ts
  → GET  /api/time/my-day
  → POST /api/time/clock-in | clock-out | status
       → lib/services/time-tracking.service.ts
       → Prisma TimeLog + ActivityStatus
```

### Admin floor monitor

```
/admin/overview
  → components/admin/AdminOverviewDashboard.tsx (polls every 15s)
  → GET /api/admin/overview
       → lib/services/admin-dashboard.service.ts

/admin/reports
  → components/admin/AdminReportsDashboard.tsx
  → GET /api/admin/timesheets

/admin/team
  → components/admin/TeamInviteDashboard.tsx
  → GET /api/organization/team
  → PATCH /api/organization/members/[memberId]/role
  → GET/PATCH /api/organization/join-settings
```

---

## Directory map

### `app/` — routes

#### Pages

| Path | File | Purpose |
|------|------|---------|
| `/` | `app/page.tsx` | Redirect to `/login` |
| `/login` | `app/(auth)/login/page.tsx` | Login |
| `/register` | `app/(auth)/register/page.tsx` | Owner password signup |
| `/onboarding` | `app/(auth)/onboarding/page.tsx` | Create org or redirect by role |
| `/join/[orgSlug]` | `app/join/[orgSlug]/page.tsx` | Employee join (enter work email) |
| `/join/[orgSlug]/complete` | `app/join/[orgSlug]/complete/page.tsx` | Post–magic-link membership completion |
| `/employee/track` | `app/(dashboard)/employee/track/page.tsx` | Employee time card |
| `/admin/overview` | `app/(dashboard)/admin/overview/page.tsx` | Floor monitor |
| `/admin/reports` | `app/(dashboard)/admin/reports/page.tsx` | Timesheets + CSV |
| `/admin/team` | `app/(dashboard)/admin/team/page.tsx` | Join link + allowed domains |
| `/billing/checkout` | `app/(dashboard)/billing/checkout/page.tsx` | Billing placeholder |
| `/track` | `app/track/page.tsx` | Redirect to `/employee/track` |
| `/developer/sandbox` | `app/developer/sandbox/page.tsx` | Dev-only API sandbox |

#### Layout guards

| File | Purpose |
|------|---------|
| `app/(dashboard)/admin/layout.tsx` | Admin role guard + wraps pages in `AdminShell` sidebar |
| `components/layout/AdminShell.tsx` | Persistent admin nav (Floor Monitor, Reports, Team) |
| `app/layout.tsx` | Root HTML shell |
| `app/globals.css` | Global styles / theme |

#### API routes

| Path | File | Purpose |
|------|------|---------|
| `/api/auth/*` | `app/api/auth/[...all]/route.ts` | Better Auth handler (sessions, magic link, org plugin) |
| `POST /api/time/clock-in` | `app/api/time/clock-in/route.ts` | Start shift |
| `POST /api/time/clock-out` | `app/api/time/clock-out/route.ts` | End shift |
| `POST /api/time/status` | `app/api/time/status/route.ts` | Change activity status |
| `GET /api/time/my-day` | `app/api/time/my-day/route.ts` | Today's log; admin may pass `?userId=` |
| `GET /api/admin/overview` | `app/api/admin/overview/route.ts` | Floor monitor data |
| `GET /api/admin/timesheets` | `app/api/admin/timesheets/route.ts` | Date-range timesheets |
| `POST /api/organization/bootstrap` | `app/api/organization/bootstrap/route.ts` | Seed statuses + join metadata |
| `GET /api/organization/team` | `app/api/organization/team/route.ts` | Org members + actor role (admin) |
| `PATCH /api/organization/members/[memberId]/role` | `app/api/organization/members/[memberId]/role/route.ts` | Change member role (admin) |
| `GET/PATCH /api/organization/join-settings` | `app/api/organization/join-settings/route.ts` | Allowed domains + join URL |
| `POST /api/join/request-magic-link` | `app/api/join/request-magic-link/route.ts` | Domain check + send magic link |

All custom APIs return `{ success, data }` or `{ success: false, error: { code, message } }` via `lib/http/api-handler.ts`.

---

### `components/` — UI

#### Feature components

| Directory / file | Purpose |
|------------------|---------|
| `login-form.tsx` | Email/password login, role redirect |
| `signup-form.tsx` | Owner registration |
| `onboarding-form.tsx` | Create organization workspace |
| `auth-brand.tsx` | Logo on auth cards |
| `join/JoinForm.tsx` | Employee work-email + magic link request |
| `employee/TimeCardDashboard.tsx` | Main employee dashboard |
| `employee/TimerSidebarPanel.tsx` | Clock in/out, status buttons, timer |
| `employee/TodayStatusLog.tsx` | Today's activity table |
| `admin/AdminOverviewDashboard.tsx` | Floor monitor shell |
| `admin/FloorKpiStrip.tsx` | KPI summary strip |
| `admin/LiveFloorTable.tsx` | Live agent table |
| `admin/AgentDetailDrawer.tsx` | Per-agent day detail |
| `admin/AdminReportsDashboard.tsx` | Timesheets + CSV export |
| `admin/TeamInviteDashboard.tsx` | Shareable join link, domain config, members |
| `developer/ApiSandboxDashboard.tsx` | Dev API playground |
| `layout/EmployeeShell.tsx` | Employee page chrome |
| `layout/AppLogo.tsx` | App logo |

#### `components/ui/` — primitives

Reusable shadcn-style building blocks: `button`, `input`, `card`, `field`, `Table`, `Toast`, `DashboardHeader`, `Skeleton`, `StatusBadge`, etc.

---

### `hooks/`

| File | Purpose |
|------|---------|
| `useTimeTracking.ts` | Client state for employee time APIs: load day, clock in/out, set status, errors |

---

### `lib/` — core logic

#### Auth

| File | Purpose |
|------|---------|
| `auth.ts` | Server Better Auth config (Prisma, magic link, organization plugins) |
| `auth-client.ts` | Client Better Auth (`magicLinkClient`, `organizationClient`) |
| `auth/server-session.ts` | Server session helpers for layouts and redirects |

#### Database

| File | Purpose |
|------|---------|
| `db/prisma.ts` | Prisma client singleton |

#### HTTP

| File | Purpose |
|------|---------|
| `api.ts` | Browser `fetch` wrapper with credentials |
| `http/api-handler.ts` | JSON envelope, error code → HTTP status |
| `http/session-route.ts` | Authenticated / admin route wrappers |

#### Security

| File | Purpose |
|------|---------|
| `security/session-context.ts` | Resolve user + org + role from session |
| `security/organization-context.ts` | Verify membership for time-tracking ops |
| `security/activity-status.ts` | Resolve activity status records |
| `security/middleware-session.ts` | Cookie check for edge middleware |

#### Services (start here when APIs break)

| File | Purpose |
|------|---------|
| `services/time-tracking.service.ts` | Clock in/out, status transitions, my-day aggregation |
| `services/admin-dashboard.service.ts` | Floor overview, compliance alerts, timesheets |
| `services/join.service.ts` | Join by slug, domain validation, member creation, join settings |
| `services/organization-bootstrap.service.ts` | Seed default activity statuses |
| `services/organization-team.service.ts` | Team roster + role updates for admin UI |

#### Organization

| File | Purpose |
|------|---------|
| `organization/metadata.ts` | Parse/serialize `allowedDomains` in `Organization.metadata` |
| `organization/roles.ts` | Role helpers: `isAdminRole`, `canAssignRole`, `canEditMemberRole` |

#### Validators (Zod)

| File | Purpose |
|------|---------|
| `validators/time-tracking.ts` | Time API request/query schemas |
| `validators/admin.ts` | Admin API schemas |
| `validators/join.ts` | Join + domain settings schemas |
| `validators/organization.ts` | Team role update schema |

#### Errors

| File | Purpose |
|------|---------|
| `errors/time-tracking.ts` | Time-tracking error codes |
| `errors/join.ts` | Join error codes |
| `errors/join-service.ts` | Join service `fail()` helper |

#### Utils

| File | Purpose |
|------|---------|
| `utils/time.ts` | UTC timestamps, segment math |
| `utils/format-time.ts` | Elapsed timer formatting |
| `utils/employee-status.ts` | Display status helpers |
| `utils/status-type.ts` | Productive / break type helpers |
| `utils/admin-metrics.ts` | Durations, CSV export, date ranges |
| `utils/floor-filters.ts` | Admin floor table filters |
| `utils/org-slug.ts` | Company name → URL slug |
| `utils.ts` | `cn()` classname helper |

#### Constants

| File | Purpose |
|------|---------|
| `constants/default-activity-statuses.ts` | Default statuses seeded per org (Available, Lunch, etc.) |

#### Developer

| File | Purpose |
|------|---------|
| `developer/sandbox-endpoints.ts` | Endpoint catalog for dev sandbox |

---

### `test/` — automated tests

| File | Purpose |
|------|---------|
| `fixtures/time-log.ts` | Shared org/user/segment fixtures for service tests |
| `lib/**/__tests__/*.test.ts` | Vitest unit tests (time math, join, tracking, admin) |

Run: `pnpm test` (watch), `pnpm test:run` (unit, CI), or `pnpm test:integration` (requires `pnpm test:db:up` + `pnpm test:db:migrate` against `docker-compose.test.yml` on port **5435**). Join concurrency and `request-magic-link` route tests live in the integration project. Optional k6 script: `loadtests/join-magic-link.k6.js`.

---

### `types/`

| File | Purpose |
|------|---------|
| `time-tracking.ts` | Client types for my-day, sessions, statuses |
| `admin-dashboard.ts` | Floor overview and timesheet types |

---

### `prisma/`

| File | Purpose |
|------|---------|
| `schema.prisma` | Database schema (source of truth) |
| `migrations/` | Applied migration history |
| `seed.ts` | Demo data: `demo@example.com`, org `demo-company`, join metadata |

#### Data model (simplified)

```
User
  └── Member ── Organization
                    ├── ActivityStatus  (per-org status definitions)
                    ├── TimeLog         (clock segments; open segment = endTime null)
                    └── metadata (JSON: allowedDomains)

Better Auth tables: Session, Account, Verification, Invitation
```

#### Time log model

- **Clock in** creates a `TimeLog` row starting on **Available**.
- **Status change** closes the current open segment and opens a new one.
- **Clock out** sets `endTime` on the open segment.

---

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth signing secret |
| `BETTER_AUTH_URL` | Server-side auth base URL |
| `NEXT_PUBLIC_APP_URL` | Public app URL (magic link callbacks, join links) |

Local Postgres: `docker compose up -d` (port **5434**).

---

## Debugging guide

| Symptom | Where to look |
|---------|----------------|
| Login / session issues | `lib/auth.ts`, `app/api/auth/`, `middleware.ts` |
| Magic link / join fails | `app/api/join/`, `lib/services/join.service.ts`, `sendMagicLink` stub in `lib/auth.ts` |
| Wrong org / tenant leak | `lib/security/session-context.ts`, `join.service.ts` (slug resolution) |
| Clock in/out / status bugs | `lib/services/time-tracking.service.ts`, `hooks/useTimeTracking.ts` |
| Admin floor wrong / stale | `lib/services/admin-dashboard.service.ts`, `AdminOverviewDashboard.tsx` |
| Domain rejected on join | `lib/organization/metadata.ts`, `/api/organization/join-settings` |
| Schema / DB errors | `prisma/schema.prisma`, run `pnpm db:migrate` |
| 401 on time APIs | Missing session cookie or no `activeOrganizationId` on session |

### Dev shortcuts

- Demo login: `demo@example.com` / `DemoPassword1!`
- Demo join URL: `http://localhost:3000/join/demo-company` (requires `@example.com` email)
- Magic links are logged to the server console (no real email in dev)
- API sandbox: `/developer/sandbox` (dev only)

---

## Scripts

```bash
pnpm dev          # Start dev server
pnpm lint         # ESLint
pnpm test         # Vitest (watch)
pnpm test:run     # Vitest (single run, used in CI)
pnpm db:up        # Start Postgres (Docker)
pnpm db:migrate   # Apply Prisma migrations
pnpm db:seed      # Seed demo org + user
pnpm db:studio    # Prisma Studio
```

See [API_REFERENCE.md](./API_REFERENCE.md) for endpoint-level detail.
