# Load tests (k6)

Optional stress checks against a **running** deployment (staging or local dev).

Install k6: https://k6.io/docs/get-started/installation/

---

## Simultaneous agent clock-in (TKT-224)

Exercises `POST /api/time/clock-in` with Better Auth session cookies. Targets the partial unique index on `time_log` (`endTime IS NULL` → at most one open segment per user + organization).

### Required environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE_URL` | Yes | Deployment origin, e.g. `http://localhost:3000` |
| `MODE` | No | `race` (default) or `multi-agent` |
| `VUS` | No | Virtual users (default `100`) |
| `DURATION` | No | Test duration for `multi-agent` mode (default `30s`) |
| `ORG_SLUG` | Yes* | Active organization slug after sign-in (default `demo-company`) |
| `ORGANIZATION_ID` | Alt | Use instead of `ORG_SLUG` when set |
| `AGENT_EMAIL` | `race` | Single account all VUs share (default `demo@example.com`) |
| `AGENT_PASSWORD` | Yes | Password for sign-in (default `DemoPassword1!`) |
| `AGENT_EMAIL_PREFIX` | `multi-agent` | Email local-part prefix (default `loadtest-agent`) |
| `EMAIL_DOMAIN` | `multi-agent` | Domain for generated emails (default `example.com`) |
| `RESET_BEFORE_RUN` | No | `clock-out` each agent in setup (default `true`) |

\* `ORG_SLUG` or `ORGANIZATION_ID` must resolve to an org the agents belong to.

### Auth flow (k6 `setup`)

1. `POST /api/auth/sign-in/email` with `{ email, password }` — stores `better-auth.session_token` in a per-agent cookie jar.
2. `POST /api/auth/organization/set-active` with `{ organizationSlug }` or `{ organizationId }`.
3. Optional `POST /api/time/clock-out` when `RESET_BEFORE_RUN=true`.
4. Each VU calls `POST /api/time/clock-in` with its jar.

Pre-baked `SESSION_COOKIES` are **not** supported in this script; sign-in in `setup` keeps the artifact self-contained. For very large VU counts, consider exporting cookies from a one-off script and forking the test to skip sign-in.

### Modes

**`race` (minimal viable / duplicate-shift probe)** — one seeded user, all VUs fire clock-in at once (`shared-iterations`). Expect exactly **one** `200` and the rest `409 USER_ALREADY_CLOCKED_IN` if the partial unique index and service layer behave correctly. Uses the demo seed user out of the box.

```bash
k6 run loadtests/simultaneous-clockin.k6.js \
  -e BASE_URL=http://localhost:3000 \
  -e MODE=race \
  -e AGENT_EMAIL=demo@example.com \
  -e AGENT_PASSWORD=DemoPassword1! \
  -e ORG_SLUG=demo-company \
  -e VUS=100
```

Custom metrics: `clock_in_success`, `clock_in_already_clocked_in`, `clock_in_other_error`, `auth_failure`, `clock_in_success_rate`.

**`multi-agent` (org-wide shift start)** — one distinct agent per VU (`loadtest-agent-1@example.com`, …). Requires members pre-created in the target org (same password). Sign-in runs once per VU in `setup`, so prefer staging or a dedicated load-test database.

```bash
# After seeding loadtest-agent-1..N members (see limitations below)
k6 run loadtests/simultaneous-clockin.k6.js \
  -e BASE_URL=http://localhost:3000 \
  -e MODE=multi-agent \
  -e AGENT_EMAIL_PREFIX=loadtest-agent \
  -e EMAIL_DOMAIN=example.com \
  -e AGENT_PASSWORD=DemoPassword1! \
  -e ORG_SLUG=demo-company \
  -e VUS=100 \
  -e DURATION=30s
```

### Limitations

- **Auth weight:** Each VU signs in during `setup`. For 100+ VUs this adds startup latency and hits Better Auth; `race` mode needs only one sign-in.
- **User provisioning:** `multi-agent` does not create users — seed members + credentials before the run. Same-user duplicate-shift races are covered by Vitest (`lib/services/__tests__/time-tracking.service.integration.test.ts`); this k6 test adds HTTP + cookie + DB path coverage.
- **Rate limits:** Join endpoints are rate-limited; clock-in is not, but auth sign-in may be throttled on shared staging.
- **Single node:** In-memory rate limiters and session state assume one app instance unless staging uses shared session storage.

---

## Join magic-link throughput

```bash
# Local (demo seed org)
k6 run loadtests/join-magic-link.k6.js \
  -e BASE_URL=http://localhost:3000 \
  -e ORG_SLUG=demo-company \
  -e EMAIL_DOMAIN=example.com \
  -e VUS=50 \
  -e DURATION=30s

# Staging
k6 run loadtests/join-magic-link.k6.js \
  -e BASE_URL=https://your-staging.example.com \
  -e ORG_SLUG=your-org-slug \
  -e EMAIL_DOMAIN=yourcompany.com \
  -e VUS=100 \
  -e DURATION=60s
```

**Note:** This exercises `POST /api/join/request-magic-link` only. Full join completion (magic-link verify + `completeOrganizationJoin`) requires email delivery and browser/cookie flow — use integration tests in Vitest for DB concurrency instead.
