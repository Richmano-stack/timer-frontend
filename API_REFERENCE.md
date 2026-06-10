# API Reference — Timer Frontend

> **Generated from static analysis of** `app/api/**/*` **and downstream service/validation layers.**  
> **Last scanned:** 11 custom route handlers + Better Auth proxy  
> **Base URL (local dev):** `http://localhost:3000`  
> **See also:** [ARCHITECTURE.md](./ARCHITECTURE.md) for full system map and user journeys.

---

## Global Conventions

### Response Envelope

Every **custom** route handler returns JSON using this envelope (via `lib/http/api-handler.ts`):

```json
{
  "success": true,
  "data": { }
}
```

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_STRING",
    "message": "Human-readable message"
  }
}
```

Better Auth routes under `/api/auth/*` use Better Auth's own response shapes (not this envelope).

### Authentication & Authorization

| Item | Current implementation |
|------|------------------------|
| Edge middleware | `middleware.ts` protects `/employee`, `/admin`, `/onboarding`, `/billing` pages (session cookie required) |
| Custom API auth | **Session cookie** via Better Auth; identity is **not** passed in request body |
| Active tenant | `session.session.activeOrganizationId` on the Better Auth session |
| Member routes | `executeAuthenticatedRoute` — logged-in member of active org (`lib/http/session-route.ts`) |
| Admin routes | `executeAdminRoute` — same + `owner` or `admin` role (`lib/security/session-context.ts`) |
| Public routes | `POST /api/join/request-magic-link` only (no session required) |

**Client requests must include cookies:**

```http
Cookie: <better-auth session cookie>
```

The browser client in `lib/api.ts` sets `credentials: 'include'` automatically.

### Identity resolution

Custom routes resolve context in `lib/security/session-context.ts`:

1. `auth.api.getSession({ headers })` — read session from cookie
2. Require `session.session.activeOrganizationId`
3. Verify `Member` row exists for `(organizationId, userId)`
4. Admin routes additionally require `member.role` ∈ `{ owner, admin }`

`userId` and `organizationId` are **never** accepted from the client for authorization on time/admin/org routes.

### Content Type

POST/PATCH endpoints expect:

```http
Content-Type: application/json
```

### Timestamps

`DateTime` fields from services are serialized as **ISO 8601 UTC strings** (e.g. `"2026-06-10T12:40:25.170Z"`).

### Error Code → HTTP Status Mapping

Defined in `lib/http/api-handler.ts`:

| Error Code | HTTP Status |
|------------|-------------|
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `NO_ACTIVE_ORGANIZATION` | 403 |
| `USER_NOT_IN_COMPANY` | 403 |
| `DOMAIN_NOT_ALLOWED` | 403 |
| `NO_ALLOWED_DOMAINS` | 403 |
| `VALIDATION_ERROR` | 400 |
| `ORGANIZATION_NOT_FOUND` | 404 |
| `NO_ACTIVE_SESSION_FOUND` | 404 |
| `TIMELOG_NOT_FOUND` | 404 |
| `ACTIVITY_STATUS_NOT_FOUND` | 404 |
| `NO_ACTIVE_BREAK_FOUND` | 404 |
| `USER_ALREADY_CLOCKED_IN` | 409 |
| `ALREADY_MEMBER` | 409 |
| `BREAK_ALREADY_ACTIVE` | 409 |
| `INTERNAL_SERVER_ERROR` | 500 |
| Unknown codes | 400 (fallback) |

---

## Better Auth — `/api/auth/*`

**Handler:** `app/api/auth/[...all]/route.ts` (proxies all Better Auth endpoints)

Not wrapped in the `{ success, data }` envelope. Used for:

| Area | Example paths / client methods |
|------|--------------------------------|
| Email/password | `signIn.email`, `signUp.email` |
| Magic link | `POST /api/auth/sign-in/magic-link`, `GET /api/auth/magic-link/verify` |
| Session | `getSession`, `signOut` |
| Organization plugin | `organization.create`, `organization.setActive`, `organization.getFullOrganization`, etc. |

Configure plugins in `lib/auth.ts`. Client: `lib/auth-client.ts`.

---

## Time Tracking

All time routes use **authenticated member** context. `userId` and `organizationId` come from the session.

### Data model note

Time is stored as **flat `TimeLog` segments** (not separate shift + activity tables):

- Each row is one contiguous status period (`startTime`, optional `endTime`)
- **Clock in** creates an open segment on **Available**
- **Status change** closes the current segment and opens a new one
- **Clock out** sets `endTime` on the open segment

---

## POST /api/time/clock-in

**Access:** Authenticated member  
**Service:** `clockInService()` in `lib/services/time-tracking.service.ts`

Starts a new shift by creating an open `TimeLog` segment. Fails with `409` if the user already has an open segment (`endTime IS NULL`).

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `notes` | `string` | Optional | Stored on the segment |

```json
{
  "notes": "Starting morning shift"
}
```

Empty body `{}` is valid.

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "segment": {
      "id": "uuid",
      "userId": "string",
      "organizationId": "string",
      "activityStatusId": "uuid",
      "statusName": "Available",
      "type": "PRODUCTIVE",
      "colorCode": "#6366f1",
      "isBillable": true,
      "isProductive": true,
      "startTime": "2026-06-10T12:40:25.170Z",
      "endTime": null,
      "notes": "Starting morning shift"
    }
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `UNAUTHORIZED` | 401 | No session |
| `NO_ACTIVE_ORGANIZATION` | 403 | Session has no active org |
| `USER_NOT_IN_COMPANY` | 403 | Not a member of active org |
| `USER_ALREADY_CLOCKED_IN` | 409 | Open segment already exists |
| `VALIDATION_ERROR` | 400 | Invalid JSON or body |

---

## POST /api/time/clock-out

**Access:** Authenticated member  
**Service:** `clockOutService()`

Closes the user's open `TimeLog` segment (`endTime = now`).

### Request body

None (empty body or `{}`).

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "segment": {
      "id": "uuid",
      "endTime": "2026-06-10T17:00:00.000Z",
      "statusName": "Available"
    }
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `NO_ACTIVE_SESSION_FOUND` | 404 | No open segment |

---

## POST /api/time/status

**Access:** Authenticated member  
**Service:** `setStatusService()`

Switches activity on an open shift. Closes the current segment and opens a new one for the target status.

Omit both `statusId` and `statusName` to switch to **Available**.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `statusId` | UUID string | Optional | Target `ActivityStatus.id` |
| `statusName` | string | Optional | Alternative lookup by name |

Provide **one of** `statusId` or `statusName`, not both.

```json
{
  "statusId": "00000000-0000-4000-8000-000000000101"
}
```

```json
{}
```

(empty body → Available)

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "segment": {
      "id": "uuid",
      "statusName": "Handling Contact",
      "startTime": "2026-06-10T13:00:00.000Z",
      "endTime": null
    }
  }
}
```

If already on the requested status, returns the current segment unchanged.

### Common errors

| Code | Status | When |
|------|--------|------|
| `NO_ACTIVE_SESSION_FOUND` | 404 | Not clocked in |
| `ACTIVITY_STATUS_NOT_FOUND` | 404 | Unknown status for this org |

---

## GET /api/time/my-day

**Access:** Authenticated member (own day) **or** admin with `?userId=`  
**Service:** `getMyDayService()`

Returns employee day view: active session, org statuses, shifts, activities, timeline, summary.

### Query parameters

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `date` | `YYYY-MM-DD` | Optional | Defaults to UTC today |
| `userId` | string | Optional | **Admin only** — view another member's day |

```
GET /api/time/my-day?date=2026-06-10
GET /api/time/my-day?userId=<memberId>&date=2026-06-10
```

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "employeeName": "Demo Owner",
    "date": "2026-06-10",
    "activeSession": {
      "activeSegment": null
    },
    "activityStatuses": [
      {
        "id": "uuid",
        "name": "Available",
        "type": "PRODUCTIVE",
        "colorCode": "#6366f1",
        "isBillable": true,
        "isProductive": true
      }
    ],
    "shifts": [],
    "activities": [],
    "timeline": [],
    "summary": {
      "gross": "0.00",
      "breaks": "0.00",
      "net": "0.00"
    }
  }
}
```

Types: `types/time-tracking.ts` (`MyDayResponse`).

### Access notes

- Without `userId`: any authenticated member sees **their own** day
- With `userId`: requires **admin** role; `organizationId` still from session (not from query)

---

## Admin

All admin routes require **admin or owner** role on the active organization.

---

## GET /api/admin/overview

**Access:** Admin  
**Service:** `getAdminOverviewService()`

Real-time floor monitor payload: KPIs, status breakdown, agent rows, compliance alerts.

### Query parameters

None.

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "kpis": {
      "activeShiftCount": 3,
      "onBreakCount": 1,
      "availableCount": 2,
      "offFloorCount": 5,
      "totalRegistered": 10
    },
    "statusBreakdown": [
      { "name": "Available", "count": 2, "isProductive": true }
    ],
    "floorAgents": [
      {
        "userId": "string",
        "employeeName": "Jane Agent",
        "timeLogId": "uuid-or-null",
        "clockIn": "2026-06-10T08:00:00.000Z",
        "displayStatus": "Available",
        "isProductive": true,
        "statusSince": "2026-06-10T08:00:00.000Z",
        "breakToday": "0.50",
        "isOnShift": true
      }
    ],
    "complianceAlerts": []
  }
}
```

Types: `types/admin-dashboard.ts` (`AdminOverviewResponse`).

---

## GET /api/admin/timesheets

**Access:** Admin  
**Service:** `getTimesheetsService()`

Timesheet rows for a date range (closed shifts).

### Query parameters

| Parameter | Type | Required |
|-----------|------|----------|
| `startDate` | `YYYY-MM-DD` | **Required** |
| `endDate` | `YYYY-MM-DD` | **Required** |

```
GET /api/admin/timesheets?startDate=2026-06-01&endDate=2026-06-10
```

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "timeLogId": "uuid",
        "userId": "string",
        "employeeName": "Jane Agent",
        "date": "2026-06-10",
        "clockIn": "2026-06-10T08:00:00.000Z",
        "clockOut": "2026-06-10T17:00:00.000Z",
        "clockInFormatted": "8:00 AM",
        "clockOutFormatted": "5:00 PM",
        "breakDeductions": "0.50",
        "netWorkHours": "8.00"
      }
    ]
  }
}
```

---

## Organization

---

## POST /api/organization/bootstrap

**Access:** Admin  
**Service:** `seedDefaultActivityStatuses()` + `initializeJoinMetadata()`

Called after org creation during onboarding. Seeds default activity statuses and initializes join metadata (`allowedDomains` from owner email).

### Request body

None.

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "seeded": 8,
    "joinMetadataInitialized": true
  }
}
```

---

## GET /api/organization/join-settings

**Access:** Admin  
**Service:** `getJoinSettingsForAdmin()`

Returns shareable join URL and allowed email domains. Lazily initializes join metadata from owner email if missing.

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "organizationId": "string",
    "organizationName": "Demo Company",
    "organizationSlug": "demo-company",
    "allowedDomains": ["example.com"],
    "joinUrl": "http://localhost:3000/join/demo-company"
  }
}
```

---

## PATCH /api/organization/join-settings

**Access:** Admin  
**Service:** `updateJoinSettings()`

Updates allowed email domains for employee self-serve join.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `allowedDomains` | `string[]` | **Required** | 1–20 domains, e.g. `["acme.com"]` |

```json
{
  "allowedDomains": ["example.com", "acme.co.uk"]
}
```

### Success — `200 OK`

Same shape as `GET /api/organization/join-settings`.

---

## Join (public)

---

## POST /api/join/request-magic-link

**Access:** **Public** (no session)  
**Service:** `validateJoinEmail()` + Better Auth `auth.api.signInMagicLink`

Employee enters work email on `/join/{orgSlug}`. Server validates domain against org `metadata.allowedDomains`, then sends a Better Auth magic link.

Membership is **not** created here — that happens on `/join/{orgSlug}/complete` after the user clicks the link.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | email string | **Required** | Work email to verify |
| `orgSlug` | string | **Required** | Organization slug from join URL |

```json
{
  "email": "agent@example.com",
  "orgSlug": "demo-company"
}
```

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "message": "Magic link sent. Check your inbox to continue joining the team.",
    "organizationName": "Demo Company"
  }
}
```

In development, the link URL is logged to the server console (`[magic-link] Sign-in link stub` in `lib/auth.ts`).

### Common errors

| Code | Status | When |
|------|--------|------|
| `ORGANIZATION_NOT_FOUND` | 404 | Unknown `orgSlug` |
| `DOMAIN_NOT_ALLOWED` | 403 | Email domain not in allowlist |
| `NO_ALLOWED_DOMAINS` | 403 | Org has no domains configured |
| `VALIDATION_ERROR` | 400 | Invalid email or slug |

### Post-magic-link flow (not an API route)

```
GET /api/auth/magic-link/verify?token=...&callbackURL=/join/{orgSlug}/complete
  → Better Auth creates session (and user if new)
  → Redirect to /join/{orgSlug}/complete (server page)
  → completeOrganizationJoin() adds Member row
  → setActiveOrganization
  → Redirect to /employee/track
```

---

## Appendix A — Prisma Tables Referenced

| Table | Model | Used by |
|-------|-------|---------|
| `user` | `User` | Auth, members, time logs |
| `session` | `Session` | Better Auth sessions (`activeOrganizationId`) |
| `organization` | `Organization` | Tenant; `metadata` JSON for join settings |
| `member` | `Member` | User ↔ org membership and role |
| `activity_status` | `ActivityStatus` | Per-org status definitions |
| `time_log` | `TimeLog` | Clock segments (shift + status history) |
| `invitation` | `Invitation` | Better Auth org plugin (legacy per-email flow unused) |

---

## Appendix B — Route Inventory

| Method | Path | Access | Service / handler |
|--------|------|--------|-------------------|
| `*` | `/api/auth/*` | Varies | Better Auth (`lib/auth.ts`) |
| `POST` | `/api/time/clock-in` | Member | `clockInService` |
| `POST` | `/api/time/clock-out` | Member | `clockOutService` |
| `POST` | `/api/time/status` | Member | `setStatusService` |
| `GET` | `/api/time/my-day` | Member / Admin† | `getMyDayService` |
| `GET` | `/api/admin/overview` | Admin | `getAdminOverviewService` |
| `GET` | `/api/admin/timesheets` | Admin | `getTimesheetsService` |
| `POST` | `/api/organization/bootstrap` | Admin | `seedDefaultActivityStatuses`, `initializeJoinMetadata` |
| `GET` | `/api/organization/join-settings` | Admin | `getJoinSettingsForAdmin` |
| `PATCH` | `/api/organization/join-settings` | Admin | `updateJoinSettings` |
| `POST` | `/api/join/request-magic-link` | Public | `validateJoinEmail` + `signInMagicLink` |

† Admin when `?userId=` is provided.

---

## Appendix C — Local Testing

### Seed data

After `pnpm db:seed`:

| Item | Value |
|------|-------|
| Email | `demo@example.com` |
| Password | `DemoPassword1!` |
| Org slug | `demo-company` |
| Join URL | `http://localhost:3000/join/demo-company` |
| Allowed domain | `example.com` |

### Testing custom APIs

Custom routes require a **logged-in session cookie**. Easiest approaches:

1. **Browser** — log in at `/login`, use the app or `/developer/sandbox` (dev only)
2. **curl** — sign in via Better Auth first, then pass the session cookie:

```bash
# Example: clock in (after obtaining session cookie from browser devtools or auth flow)
curl -X POST http://localhost:3000/api/time/clock-in \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"notes":"Test shift"}'
```

```bash
# Example: request join magic link (no cookie needed)
curl -X POST http://localhost:3000/api/join/request-magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@example.com","orgSlug":"demo-company"}'
```

### Dev sandbox

`GET /developer/sandbox` (development only) provides a UI to call time and admin endpoints with your current session. Endpoint catalog: `lib/developer/sandbox-endpoints.ts`.

---

## Appendix D — Source File Index

| Concern | Files |
|---------|-------|
| Route handlers | `app/api/**/route.ts` |
| Auth guards | `lib/http/session-route.ts`, `lib/security/session-context.ts` |
| Time logic | `lib/services/time-tracking.service.ts` |
| Admin logic | `lib/services/admin-dashboard.service.ts` |
| Join logic | `lib/services/join.service.ts`, `lib/organization/metadata.ts` |
| Validation | `lib/validators/time-tracking.ts`, `admin.ts`, `join.ts` |
| Error codes | `lib/errors/time-tracking.ts`, `lib/errors/join.ts` |
| Client fetch | `lib/api.ts` |
| Response envelope | `lib/http/api-handler.ts` |
