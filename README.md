# OmniShift — Call Center Time Tracking

**OmniShift** is a full-stack **Next.js** app for call-center time tracking: employees clock in and switch activity statuses; admins monitor the floor, export timesheets, and manage team join settings.

**Documentation:** [ARCHITECTURE.md](./ARCHITECTURE.md) (system map) · [API_REFERENCE.md](./API_REFERENCE.md) (endpoints)

---

## Features

- **Employee time card** — clock in/out, status changes, daily summary
- **Admin floor monitor** — live KPIs, agent table, compliance alerts
- **Reports** — date-range timesheets with CSV export
- **Team join** — shareable `/join/{slug}` link with allowed email domains
- **Auth** — Better Auth (email/password + magic link + organizations)

---

## Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19 |
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
```

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

---

## Demo credentials

| Item | Value |
|------|-------|
| Email | `demo@example.com` |
| Password | `DemoPassword1!` |
| Join URL | `http://localhost:3000/join/demo-company` |

Magic links are logged to the server console in development (no real email yet).
