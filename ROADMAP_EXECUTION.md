# OmniShift — Phase 1 Execution Guide (3+ Agent Parallelism)

This document is the **operational companion** to [ROADMAP.md](./ROADMAP.md). It defines explicit waves, ownership lanes, file locks, and safe agent pairings for Phase 1.

> **Path note:** Ticket descriptions in `ROADMAP.md` use a legacy `src/` prefix. In this repo, paths are rooted at the project root — e.g. `app/…`, `lib/…`, `prisma/…` (no `src/`).

---

## Rules (all agents)

1. **Claim one lane per wave.** A lane is a serialized chain of tickets assigned to a single agent for the duration of that wave.
2. **One schema owner per wave.** Only one agent may open or merge a `prisma/schema.prisma` change per wave. Default owner: `@SecurityAgent` persona (see [AGENT_ROLES.md](./AGENT_ROLES.md)).
3. **Respect file locks.** Two agents must not edit the same file in the same wave (see matrix below).
4. **Contract before UI.** `@FrontendAgent` may scaffold UI in early waves, but must not merge API integrations until the backing route exists and `lib/validators/` schemas are agreed.
5. **Integration tests last in lane.** TKT-119 runs in Wave 6 after endpoints it exercises exist.
6. **Mark completion in ROADMAP.md** by flipping `[ ]` → `[x]` only after `pnpm lint` and relevant tests pass.

---

## Lanes (one agent owns the full chain)

| Lane ID | Persona | Tickets (in order) | Hot files |
|---------|---------|-------------------|-----------|
| `AUTH` | @SecurityAgent | TKT-101 → TKT-115 → TKT-111 | `lib/auth.ts` |
| `INVITE-API` | @SecurityAgent | TKT-102 → TKT-103 | `app/api/organization/invitations/` |
| `JOIN` | @BackendAgent | TKT-104 → TKT-105 → TKT-106 → TKT-107 | `lib/services/join.service.ts`, join routes |
| `TEAM-UI` | @FrontendAgent | TKT-112 → TKT-113 → TKT-114 | `app/(dashboard)/admin/team/` |
| `ONBOARD-UI` | @FrontendAgent | TKT-116 | `app/(auth)/onboarding/` |
| `SETTINGS-UI` | @FrontendAgent | TKT-118 | `app/(dashboard)/admin/settings/` |
| `ACCESS-UI` | @FrontendAgent | TKT-117 | `app/(dashboard)/admin/layout.tsx` |
| `TENANT-SWEEP` | @SecurityAgent | TKT-108 | `lib/security/session-context.ts`, services |
| `CLOCK` | @BackendAgent | TKT-109 | `prisma/schema.prisma`, `lib/services/time-tracking.service.ts` |
| `RATE-LIMIT` | @SecurityAgent | TKT-120 | `lib/security/join-rate-limit.ts` |
| `AUDIT-ENGINE` | @SecurityAgent | TKT-121 | `lib/db/audit.ts`, `prisma/schema.prisma` |
| `EDGE-SEC` | @SecurityAgent | TKT-122 | `middleware.ts`, `lib/security/proxy.ts` |
| `ENV` | @BackendAgent | TKT-110 | `lib/env.ts`, `app/layout.tsx` |
| `SANDBOX` | @FrontendAgent | TKT-123 | `app/developer/sandbox/` |
| `CI` | @TestAgent | TKT-124 | `.github/workflows/ci.yml`, `docker-compose.test.yml` |
| `ISOLATION-TEST` | @TestAgent | TKT-119 | integration test suite |

---

## Waves

Each wave lists **parallel slots**. Assign at most one lane per slot. Do not start Wave N+1 until all lanes in Wave N are merged (or explicitly descoped).

### Wave 1 — Zero coupling (up to 5 agents)

No shared hot files. Safe maximum parallelism.

| Slot | Lane | Ticket(s) | Agent focus |
|------|------|-----------|-------------|
| A | `ENV` | TKT-110 | Zod env guard + layout import |
| B | `ACCESS-UI` | TKT-117 | Admin layout role redirect |
| C | `SANDBOX` | TKT-123 | Dev sandbox gate |
| D | `CI` | TKT-124 | Test container in CI |
| E | `EDGE-SEC` | TKT-122 | Middleware / proxy hardening |

**Gate to Wave 2:** All Wave 1 PRs merged; `pnpm lint` green.

---

### Wave 2 — Auth + invitation foundation (up to 4 agents)

| Slot | Lane | Ticket(s) | Notes |
|------|------|-----------|-------|
| A | `AUTH` | TKT-101, TKT-115 | **Single PR.** API registration gate + Google OAuth policy. Do not split across agents. |
| B | `INVITE-API` | TKT-102 | **Schema lock** — Invitation model / plugin wiring. |
| C | `ONBOARD-UI` | TKT-116 | UI-only scaffold OK; domain/timezone seeding wires in Wave 4. |
| D | `AUDIT-ENGINE` | TKT-121 | **Schema lock** — `AuditLog` table + `lib/db/audit.ts` helper. |

> **Conflict:** Slots B and D both may touch `prisma/schema.prisma`. **Pick one schema owner for Wave 2** (recommended: Slot B `INVITE-API` first; defer `AUDIT-ENGINE` schema to Wave 3 if both are active).

**Reduced 3-agent layout:** A + B + C (defer TKT-121 to Wave 3).

**Gate to Wave 3:** Registration blocked at API layer (TKT-101); POST invitations works (TKT-102).

---

### Wave 3 — Invitation management + email delivery (up to 4 agents)

| Slot | Lane | Ticket(s) | Notes |
|------|------|-----------|-------|
| A | `AUTH` | TKT-111 | Email provider + templates. Requires Wave 2 Slot A merged. |
| B | `INVITE-API` | TKT-103 | GET list + DELETE revoke on invitations routes. |
| C | `JOIN` | TKT-104 | Token page `app/join/invite/[token]/` + join service validation. |
| D | `AUDIT-ENGINE` | TKT-121 | Only if deferred from Wave 2. |

**Gate to Wave 4:** TKT-103 merged; TKT-104 token validation path exists.

---

### Wave 4 — Join hardening + team UI (up to 4 agents)

| Slot | Lane | Ticket(s) | Notes |
|------|------|-----------|-------|
| A | `JOIN` | TKT-105, TKT-106 | Domain whitelist + join-request queue. **Schema lock** if `JoinRequest` table needed. |
| B | `JOIN` (continued) | TKT-107 | Remove implicit domain-only membership. Same agent as Slot A. |
| C | `TEAM-UI` | TKT-112 | Team command center; integrate invitation APIs from Wave 3. |
| D | `SETTINGS-UI` | TKT-118 | Tenant settings (domains, join policy toggles). |

> **Wave 4 parallelism:** Slots A+B are **one agent** (JOIN lane). Effective parallel slots: **JOIN (A+B)** + **TEAM-UI (C)** + **SETTINGS-UI (D)** = **3 agents**.

**Gate to Wave 5:** TKT-107 merged; team UI wired to live invitation endpoints.

---

### Wave 5 — Team UI completion + platform hardening (up to 4 agents)

| Slot | Lane | Ticket(s) | Notes |
|------|------|-----------|-------|
| A | `TEAM-UI` | TKT-113, TKT-114 | Invite modal refactor + join-request sub-tabs. Same agent, sequential. |
| B | `TENANT-SWEEP` | TKT-108 | Session-context audit across services. |
| C | `CLOCK` | TKT-109 | Partial unique index + transactional clock mutations. **Schema lock.** |
| D | `RATE-LIMIT` | TKT-120 | Rate limits on invite, join-request, magic-link paths. |

> **Conflict:** TKT-108 and TKT-109 both touch `lib/services/time-tracking.service.ts` / service layers. If both run, **assign TKT-108 first**, then TKT-109, or use one agent for both.

**Reduced 3-agent layout:** A + B + D (defer TKT-109 to Wave 6).

**Gate to Wave 6:** Team UI complete; tenant scoping audit done.

---

### Wave 6 — Verification & closure (up to 2 agents)

| Slot | Lane | Ticket(s) | Notes |
|------|------|-----------|-------|
| A | `CLOCK` | TKT-109 | Only if deferred from Wave 5. |
| B | `ISOLATION-TEST` | TKT-119 | Cross-tenant integration suite across all Phase 1 endpoints. |

**Phase 1 exit criteria:**
- [ ] No public user creation without invitation token or owner bootstrap (TKT-101, TKT-115)
- [ ] Invitation CRUD operational (TKT-102, TKT-103)
- [ ] Token-gated join replaces open slug join (TKT-104, TKT-107)
- [ ] Domain whitelist enforced (TKT-105)
- [ ] Join-request queue optional path (TKT-106)
- [x] Tenant isolation tests green (TKT-119)
- [ ] CI runs against test DB (TKT-124)

---

## File lock matrix (never pair in the same wave)

| File / directory | Lanes that touch it |
|------------------|---------------------|
| `lib/auth.ts` | `AUTH` only (TKT-101, TKT-111, TKT-115) |
| `app/api/organization/invitations/` | `INVITE-API` only |
| `lib/services/join.service.ts` | `JOIN`, `TENANT-SWEEP` (not in same wave) |
| `app/(dashboard)/admin/team/` | `TEAM-UI` only |
| `prisma/schema.prisma` | One lane per wave — coordinate `INVITE-API`, `AUDIT-ENGINE`, `JOIN`, `CLOCK` |
| `lib/services/time-tracking.service.ts` | `TENANT-SWEEP` or `CLOCK`, not both same wave |
| `lib/security/join-rate-limit.ts` | `RATE-LIMIT` only |

---

## Never pair (even across streams)

| Ticket A | Ticket B | Reason |
|----------|----------|--------|
| TKT-101 | TKT-115 | Same file; same PR |
| TKT-101 | TKT-111 | Both mutate `lib/auth.ts` |
| TKT-102 | TKT-103 | Same route module; sequential |
| TKT-104 | TKT-105 | Same `join.service.ts`; sequential |
| TKT-105 | TKT-107 | Same service; sequential |
| TKT-112 | TKT-113 | Same team folder; sequential |
| TKT-113 | TKT-114 | Same team folder; sequential |
| TKT-108 | TKT-109 | Overlapping service audit surface |

---

## UI ↔ API contract checklist

Before merging UI integration PRs, confirm:

| UI ticket | Requires API / backend |
|-----------|------------------------|
| TKT-112 | TKT-102, TKT-103 |
| TKT-114 | TKT-106, join-request approve route |
| TKT-116 | TKT-101 owner bootstrap path; domain seed may follow TKT-118 |
| TKT-118 | Organization metadata PATCH (may need small backend route) |

---

## Quick assignment template

Copy into agent session prompts:

```
Phase 1 · Wave {N} · Lane {LANE_ID}
Ticket(s): {TKT-xxx}
Do NOT edit: {locked files from other lanes}
Schema changes: {yes/no — if yes, you are the sole schema owner this wave}
Exit: {gate criteria from wave section}
```

**Example (3 agents, Wave 2):**
- Agent 1 → `AUTH` → TKT-101 + TKT-115
- Agent 2 → `INVITE-API` → TKT-102
- Agent 3 → `ONBOARD-UI` → TKT-116

---

## Phase 2+ note

Phase 2–3 tickets remain in [ROADMAP.md](./ROADMAP.md) without waves until Phase 1 exit criteria are met. A Phase 2 execution guide will follow the same lane + wave pattern.
