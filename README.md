# OmniShift — Call Center Time Tracking

**OmniShift** is a full-stack **Next.js** app for call-center time tracking: employees clock in and switch activity statuses; admins monitor the floor, export timesheets, and manage team join settings.

**AI Dev OS:** All product docs, roadmap, architecture, and agent rules live in [`ai/`](./ai/README.md) and [`.cursor/rules/`](./.cursor/rules/README.md).

**Status:** Phases 1–2 complete. Phase 3 (monetization, scale) is next — see [`ai/project/ROADMAP.md`](./ai/project/ROADMAP.md).

---

## Quick start

```bash
pnpm install
pnpm db:up        # Postgres on port 5434
pnpm db:migrate
pnpm db:seed      # demo@example.com / DemoPassword1!
pnpm dev          # http://localhost:3000
```

Environment variables and full setup: [`ai/project/memory/PROJECT_CONTEXT.md`](./ai/project/memory/PROJECT_CONTEXT.md).

---

## Scripts

```bash
pnpm dev | lint | test:run | test:integration | test:all
pnpm db:studio | db:migrate | db:seed
pnpm test:db:up | test:db:migrate   # integration DB (port 5435)
```

---

## Demo credentials

| Item | Value |
|------|-------|
| Email | `demo@example.com` |
| Password | `DemoPassword1!` |
| Join URL | `http://localhost:3000/join/demo-company` |
