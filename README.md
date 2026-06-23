# OmniShift — Call Center Time Tracking

**OmniShift** is a full-stack **Next.js** app for call-center time tracking: employees clock in and switch activity statuses; admins monitor the floor, export timesheets, and manage team join settings.

**Documentation:** [ARCHITECTURE.md](./ARCHITECTURE.md) (system map) · [API_REFERENCE.md](./API_REFERENCE.md) (endpoints) · [ROADMAP.md](./ROADMAP.md) (phases & tickets)

**Status:** Phase 1 (tenant foundation & access control) and **Phase 2** (owner workspace & operational reliability) are implemented in code. **Phase 3** (monetization, scale & advanced operations) is next — see [ROADMAP.md](./ROADMAP.md#phase-3--monetization-scale--advanced-operations).

---

## Features

### Employee

- **Time card** (`/employee/track`) — clock in/out, activity status changes, daily summary
- **Offline resilience** — offline banner, queued actions with idempotency keys, auto-sync on reconnect
- **Presence heartbeat** — periodic `POST /api/time/heartbeat` while the time card is open

### Admin

- **Floor monitor** (`/admin/overview`) — live KPIs, agent table, SSE stream with polling fallback, compliance alerts
- **Reports** (`/admin/reports`) — timezone-aware date range, agent filter, CSV export, timesheet corrections with audit trail
- **Team** (`/admin/team`) — invitations, join requests, member suspend/reactivate, domain whitelist
- **Settings** (`/admin/settings`) — org name, timezone, join policy, compliance limits (shift/break/lunch), audit log viewer, activity status customizer
- **Data export** — `GET /api/admin/export` (ZIP: members, time logs, audit logs)

### Platform

- **Team join** — email invitations, allowed domains, optional join-request queue, token-gated onboarding
- **Auth** — Better Auth (email/password, Google OAuth, magic link, organizations)
- **Observability** — structured API request logs, Sentry multi-tenant tags, `GET /api/health`
- **Security** — production CSP / security headers, cross-tenant isolation tests, append-only audit logs

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19 |
| Client data | TanStack Query v5 |
| Auth | Better Auth |
| Database | PostgreSQL + Prisma |
| Styling | Tailwind CSS 4, shadcn/ui-style components |
| Tests | Vitest |

---

## Getting started

### 1. Install

```bash
pnpm install
```

### 2. Environment

Create `.env.local`:

```env
DATABASE_URL=postgresql://user:pass@localhost:5434/timer
BETTER_AUTH_SECRET=<random-secret>
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth (optional for local dev; required for "Continue with Google")
GOOGLE_CLIENT_ID=<google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>

# Email (optional in local dev — magic links log to the server console without an API key)
# Required in production (validated at startup via lib/env.ts)
EMAIL_FROM="OmniShift <noreply@yourdomain.com>"
RESEND_API_KEY=<resend-api-key>
# EMAIL_PROVIDER=resend   # resend (default) | postmark | sendgrid
# POSTMARK_SERVER_TOKEN=    # when EMAIL_PROVIDER=postmark
# SENDGRID_API_KEY=         # when EMAIL_PROVIDER=sendgrid

# Cron (optional in local dev; required in production)
CRON_SECRET=<random-cron-secret>

# Sentry (optional in local dev; SENTRY_DSN required in production)
# Server/edge use SENTRY_DSN; browser needs NEXT_PUBLIC_SENTRY_DSN (same ingest URL).
SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
NEXT_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
```

#### Google OAuth setup

1. In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**, create an **OAuth 2.0 Client ID** (Web application).
2. Add an **Authorized redirect URI**:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://<your-domain>/api/auth/callback/google`
3. Copy the Client ID and Client Secret into `.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
4. Ensure `BETTER_AUTH_URL` matches the origin used in the redirect URI (e.g. `http://localhost:3000`).

### 3. Database

```bash
pnpm db:up        # Docker Postgres on port 5434
pnpm db:migrate
pnpm db:seed      # demo@example.com / DemoPassword1!
```

### 4. Dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

```bash
pnpm dev          # Dev server
pnpm lint         # ESLint
pnpm test         # Vitest (watch)
pnpm test:run     # Unit tests only (CI)
pnpm test:integration  # DB + route tests (requires test Postgres)
pnpm test:all     # Unit + integration
pnpm db:studio    # Prisma Studio
```

### Test database (integration / join concurrency)

```bash
pnpm test:db:up       # Docker Postgres on port 5435 (timer_test)
pnpm test:db:migrate  # Apply migrations to test DB
pnpm test:integration
pnpm test:db:down     # Stop test Postgres
```

Optional k6 load test: see [loadtests/README.md](./loadtests/README.md).

CI (`.github/workflows/ci.yml`) runs `pnpm lint` and `pnpm test:run` (unit) on every push and pull request.

### Scheduled auto clock-out (cron)

`POST` or `GET` `/api/cron/auto-clock-out` closes open shifts that exceed the org **max shift hours** threshold (configurable under **Admin → Settings → Compliance**; defaults: 12h shift, 30min break/lunch). Authenticate with `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`.

```bash
curl -X POST http://localhost:3000/api/cron/auto-clock-out \
  -H "x-cron-secret: $CRON_SECRET"
```

---

## Roadmap

| Phase | Focus | Status |
|-------|--------|--------|
| **1** | Tenant foundation & access control | Complete |
| **2** | Owner workspace & operational reliability | Complete |
| **3** | Monetization, scale & advanced operations | Next ([TKT-301+](./ROADMAP.md#phase-3--monetization-scale--advanced-operations)) |

Ticket-level detail and parallel execution notes: [ROADMAP.md](./ROADMAP.md) · [ROADMAP_EXECUTION.md](./ROADMAP_EXECUTION.md).

---

## Demo credentials

| Item | Value |
|------|-------|
| Email | `demo@example.com` |
| Password | `DemoPassword1!` |
| Join URL | `http://localhost:3000/join/demo-company` |

Magic links are logged to the server console in development when `RESEND_API_KEY` (or another provider key) is not set. Set `EMAIL_FROM` and a provider API key to deliver real email.
