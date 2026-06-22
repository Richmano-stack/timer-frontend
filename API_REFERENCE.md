# API Reference — OmniShift

> **Generated from static analysis of** `app/api/**/*` **and downstream service/validation layers.**  
> **Last scanned:** 14 custom route handlers + Better Auth proxy  
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
| Public routes | `POST /api/join/request-magic-link`, `POST /api/join/request`, `POST /api/join/invite/{token}/request-magic-link` (no session required for magic-link paths; `/api/join/request` accepts optional session) |

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
| `RATE_LIMITED` | 429 |
| `ORGANIZATION_NOT_FOUND` | 404 |
| `NO_ACTIVE_SESSION_FOUND` | 404 |
| `TIMELOG_NOT_FOUND` | 404 |
| `ACTIVITY_STATUS_NOT_FOUND` | 404 |
| `NO_ACTIVE_BREAK_FOUND` | 404 |
| `USER_ALREADY_CLOCKED_IN` | 409 |
| `ALREADY_MEMBER` | 409 |
| `INVITATION_ALREADY_PENDING` | 409 |
| `BREAK_ALREADY_ACTIVE` | 409 |
| `INTERNAL_SERVER_ERROR` | 500 |
| Unknown codes | 400 (fallback) |

### Authentication rate limits

In-memory fixed-window limiters in `lib/security/join-rate-limit.ts` (15-minute windows). Suitable for single-node deployments; use Redis for multi-instance production.

| Endpoint | Limiter | Scopes (max / 15 min) |
|----------|---------|------------------------|
| `POST /api/join/request-magic-link` | `checkJoinMagicLinkRateLimit` | IP 10, email 5 |
| `POST /api/join/invite/{token}/request-magic-link` | `checkJoinMagicLinkRateLimit` | IP 10, email 5 |
| `POST /api/organization/invitations` | `checkInviteCreationRateLimit` | IP 20, org 10, actor 10 |
| `POST /api/join/request` (TKT-106) | `checkJoinRequestRateLimit` | IP 10, email 5, org slug 30 |

Exceeded limits return `RATE_LIMITED` (429) with a `retryAfter` message in seconds.

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
      "gross": "0m",
      "breaks": "0m",
      "net": "0.0h"
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

## GET /api/organization/settings

**Access:** Admin  
**Service:** `getOrganizationSettingsForAdmin()` in `lib/services/organization-settings.service.ts`

Returns workspace configuration for the tenant settings screen: display name, IANA timezone (from `Organization.metadata`), allowed email domains, and join approval policy.

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "organizationId": "string",
    "name": "Demo Company",
    "slug": "demo-company",
    "timezone": "America/New_York",
    "allowedDomains": ["example.com"],
    "requireApproval": false
  }
}
```

`timezone` is `null` when not yet configured.

---

## PATCH /api/organization/settings

**Access:** Admin  
**Service:** `updateOrganizationSettings()` in `lib/services/organization-settings.service.ts`

Updates organization display name and/or operational timezone. `organizationId` is taken from the authenticated admin session only.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | `string` | Optional* | 1–120 characters |
| `timezone` | `string` | Optional* | Valid IANA timezone identifier |

\* At least one of `name` or `timezone` must be provided.

```json
{
  "name": "Acme Call Center",
  "timezone": "America/Chicago"
}
```

### Success — `200 OK`

Same shape as `GET /api/organization/settings`.

Timezone is stored in `Organization.metadata` JSON alongside join settings. Allowed domains and `requireApproval` are updated via `PATCH /api/organization/join-settings`.

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
    "requireApproval": false,
    "joinUrl": "http://localhost:3000/join/demo-company"
  }
}
```

---

## PATCH /api/organization/join-settings

**Access:** Admin  
**Service:** `updateJoinSettings()`

Updates allowed email domains and/or join approval policy for employee self-serve join.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `allowedDomains` | `string[]` | Optional* | 1–20 domains, e.g. `["acme.com"]` |
| `requireApproval` | `boolean` | Optional* | When `true`, `POST /api/join/request` queues pending requests instead of immediate membership |

\* At least one of `allowedDomains` or `requireApproval` must be provided.

```json
{
  "allowedDomains": ["example.com", "acme.co.uk"],
  "requireApproval": true
}
```

### Success — `200 OK`

Same shape as `GET /api/organization/join-settings`.

Domains are **normalized on persist** (lowercase, `@` stripped). The response may echo the raw input array from the request body for `allowedDomains`.

---

## GET /api/organization/join-requests

**Access:** Admin  
**Service:** `listJoinRequestsForAdmin()` in `lib/services/join-request.service.ts`

Lists join requests for the active organization. Defaults to `PENDING` when no query parameter is supplied.

### Query parameters

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | `"PENDING"` \| `"APPROVED"` \| `"DENIED"` | Optional | Defaults to `PENDING` |

### Success — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "agent@example.com",
      "status": "PENDING",
      "createdAt": "2026-06-23T12:00:00.000Z",
      "reviewedAt": null
    }
  ]
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Invalid `status` query value |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Non-admin actor |

---

## POST /api/organization/join-requests/{id}/approve

**Access:** Admin  
**Service:** `approveJoinRequest()` in `lib/services/join-request.service.ts`

Approves a pending join request for the active organization. `organizationId` and reviewer identity come from the authenticated admin session only — the join request is looked up by `id` **and** scoped to the session tenant.

When the requester (or a user with matching email) already exists, a `Member` row is created with role `member` via `completeJoinWithApprovedRequest()`. If no user account exists yet, the request is marked `APPROVED` without creating a member; the user completes membership later by calling `POST /api/join/request` while signed in (or visiting `/join/{orgSlug}/complete` after sign-in), which redeems the approved row.

### Path parameters

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID string | **Required** | Join request id |

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "joinRequestId": "uuid",
    "organizationId": "string",
    "memberId": "uuid-or-null",
    "email": "agent@example.com"
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `JOIN_REQUEST_NOT_FOUND` | 404 | Unknown id or cross-tenant access |
| `JOIN_REQUEST_NOT_PENDING` | 409 | Already approved or denied |
| `ALREADY_MEMBER` | 409 | User is already a member |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Non-admin actor |

---

## POST /api/organization/join-requests/{id}/deny

**Access:** Admin  
**Service:** `denyJoinRequest()` in `lib/services/join-request.service.ts`

Denies a pending join request for the active organization. `organizationId` and reviewer identity come from the authenticated admin session only — the join request is looked up by `id` **and** scoped to the session tenant.

### Path parameters

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID string | **Required** | Join request id |

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "joinRequestId": "uuid",
    "email": "agent@example.com"
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `JOIN_REQUEST_NOT_FOUND` | 404 | Unknown id or cross-tenant access |
| `JOIN_REQUEST_NOT_PENDING` | 409 | Already approved or denied |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Non-admin actor |

---

## POST /api/organization/invitations

**Access:** Admin  
**Service:** `createInvitationForAdmin()` in `lib/services/invitation.service.ts`

Creates a pending organization invitation for the given email and role. `organizationId` and `inviterId` are taken from the authenticated admin session only — never from the request body. Invitation `id` serves as the redemption token for the token-gated join flow (TKT-104).

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | `string` | **Required** | Valid email address; normalized to lowercase on persist |
| `role` | `"member"` \| `"admin"` | **Required** | Must be assignable by the actor (`owner` or `admin`) |

```json
{
  "email": "agent@example.com",
  "role": "member"
}
```

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "email": "agent@example.com",
    "role": "member",
    "status": "pending",
    "expiresAt": "2026-06-29T12:00:00.000Z",
    "createdAt": "2026-06-22T12:00:00.000Z"
  }
}
```

`expiresAt` defaults to **7 days** from creation (UTC).

### Errors

| Code | Status | When |
|------|--------|------|
| `VALIDATION_ERROR` | 400 | Invalid email, role, or JSON body |
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Non-admin member, or role not assignable by actor |
| `NO_ACTIVE_ORGANIZATION` | 403 | Session has no active organization |
| `USER_NOT_IN_COMPANY` | 403 | User is not a member of the active organization |
| `ALREADY_MEMBER` | 409 | Email already belongs to a member of the organization |
| `INVITATION_ALREADY_PENDING` | 409 | A non-expired pending invitation already exists for this email |
| `RATE_LIMITED` | 429 | Too many invitation requests from same IP (20 / 15 min), organization (10 / 15 min), or actor (10 / 15 min) |

Email delivery uses `lib/email/send.ts` (Resend by default; Postmark or SendGrid when `EMAIL_PROVIDER` is set). Without a provider API key in development, messages are logged to the server console instead of being sent.

---

## GET /api/organization/invitations

**Access:** Admin  
**Service:** `listPendingInvitationsForAdmin()` in `lib/services/invitation.service.ts`

Returns pending, non-expired invitations for the authenticated admin's active organization. `organizationId` is taken from the session only — never from query parameters or the request body. Expired pending invitations and invitations in any other status (`revoked`, `accepted`) are excluded.

### Success — `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "invitation-uuid",
      "email": "agent@example.com",
      "role": "member",
      "status": "pending",
      "expiresAt": "2026-06-29T12:00:00.000Z",
      "createdAt": "2026-06-22T12:00:00.000Z"
    }
  ]
}
```

Results are ordered by `createdAt` descending (newest first). An empty array is returned when no qualifying invitations exist.

### Errors

| Code | Status | When |
|------|--------|------|
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Non-admin member |
| `NO_ACTIVE_ORGANIZATION` | 403 | Session has no active organization |
| `USER_NOT_IN_COMPANY` | 403 | User is not a member of the active organization |

---

## DELETE /api/organization/invitations/{id}

**Access:** Admin  
**Service:** `revokeInvitationForAdmin()` in `lib/services/invitation.service.ts`

Revokes a pending invitation before it is claimed. The invitation must belong to the authenticated admin's active organization; cross-tenant IDs return `404` (not `403`) to avoid leaking invitation existence across tenants.

### Path parameters

| Parameter | Type | Notes |
|-----------|------|-------|
| `id` | `string` | Invitation UUID (redemption token) |

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "invitation-uuid",
    "email": "agent@example.com",
    "role": "member",
    "status": "revoked",
    "expiresAt": "2026-06-29T12:00:00.000Z",
    "createdAt": "2026-06-22T12:00:00.000Z"
  }
}
```

### Errors

| Code | Status | When |
|------|--------|------|
| `UNAUTHORIZED` | 401 | No session |
| `FORBIDDEN` | 403 | Non-admin member |
| `NO_ACTIVE_ORGANIZATION` | 403 | Session has no active organization |
| `USER_NOT_IN_COMPANY` | 403 | User is not a member of the active organization |
| `INVITATION_NOT_FOUND` | 404 | Unknown ID or invitation belongs to another organization |
| `INVITATION_NOT_REVOCABLE` | 409 | Invitation already accepted or revoked |

---

## GET /api/organization/team

**Access:** Admin  
**Service:** `getTeamForAdmin()` in `lib/services/organization-team.service.ts`

Returns organization summary and member roster for the Team admin page. Replaces direct Better Auth `organization.getFullOrganization` calls from the client.

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "Demo Company",
    "slug": "demo-company",
    "actorRole": "owner",
    "members": [
      {
        "id": "member-uuid",
        "role": "member",
        "createdAt": "2026-06-10T12:00:00.000Z",
        "user": {
          "id": "user-uuid",
          "name": "Jane Agent",
          "email": "agent@example.com"
        }
      }
    ]
  }
}
```

`actorRole` is the caller's role in the active organization (used by the UI to decide which role changes are allowed).

---

## PATCH /api/organization/members/[memberId]/role

**Access:** Admin  
**Service:** `updateMemberRoleForAdmin()` in `lib/services/organization-team.service.ts`

Updates a member's role. Enforced server-side via `lib/organization/roles.ts`:

- Only `owner` and `admin` may call this route
- Assignable roles: `member`, `admin` (owners may assign both; admins may assign `member` only)
- Cannot change an `owner` member's role
- Admins cannot change another admin's role

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `role` | `"member"` \| `"admin"` | **Required** | Target role |

```json
{
  "role": "admin"
}
```

### Success — `200 OK`

```json
{
  "success": true,
  "data": {
    "memberId": "member-uuid",
    "role": "admin"
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `FORBIDDEN` | 403 | Actor cannot assign or edit this member's role |
| `USER_NOT_IN_COMPANY` | 403 | Member not found in active org |
| `VALIDATION_ERROR` | 400 | Invalid body |

---

## Join (public)

---

## POST /api/join/request

**Access:** Public (optional session)  
**Service:** `submitJoinRequest()` in `lib/services/join-request.service.ts`

Submits an employee join request for an organization identified by slug. `organizationId` is resolved server-side from `orgSlug` — never from the client body.

When `Organization.metadata.requireApproval` is **true**, creates a `JoinRequest` in `PENDING` status (no immediate membership). When **false** and the caller is authenticated, creates an `APPROVED` join request and completes membership via `completeJoinWithApprovedRequest()` (domain match alone never grants membership). Authenticated callers with a prior **approved** request (e.g. admin approved before the user signed up) also complete via `completeJoinWithApprovedRequest()`. Unauthenticated callers receive `AUTH_REQUIRED` and must use an invitation link (`/join/invite/{token}`).

Domain validation uses `emailMatchesAllowedDomains` against `metadata.allowedDomains` (same rules as slug join).

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `orgSlug` | string | **Required** | Organization slug from join URL |
| `email` | email string | Required if no session | Must match session email when signed in |

```json
{
  "orgSlug": "demo-company",
  "email": "agent@example.com"
}
```

### Success — `200 OK` (queued)

```json
{
  "success": true,
  "data": {
    "status": "pending",
    "joinRequestId": "uuid",
    "organizationName": "Demo Company",
    "message": "Your join request has been submitted and is awaiting administrator approval."
  }
}
```

### Success — `200 OK` (immediate join, approval disabled + session)

```json
{
  "success": true,
  "data": {
    "status": "joined",
    "organizationId": "string",
    "memberId": "uuid",
    "organizationName": "Demo Company",
    "message": "You have joined the organization."
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `ORGANIZATION_NOT_FOUND` | 404 | Unknown `orgSlug` |
| `DOMAIN_NOT_ALLOWED` | 403 | Email domain not in allowlist |
| `NO_ALLOWED_DOMAINS` | 403 | Org has no domains configured |
| `JOIN_REQUEST_ALREADY_PENDING` | 409 | Duplicate pending request for same email |
| `ALREADY_MEMBER` | 409 | Authenticated user is already a member |
| `AUTH_REQUIRED` | 401 | No session (invitation link required for new users) |
| `JOIN_REQUEST_NOT_APPROVED` | 403 | Authenticated but no approved join request backing membership |
| `VALIDATION_ERROR` | 400 | Invalid body or email/session mismatch |

---

## POST /api/join/request-magic-link

**Access:** **Public** (no session)  
**Status:** **Deprecated (TKT-107)** — returns `410 Gone` with `INVITATION_REQUIRED`. Open slug join via magic link is disabled; use `POST /api/join/invite/{token}/request-magic-link` instead.

Previously: employee entered work email on `/join/{orgSlug}` and received a Better Auth magic link. `/join/{orgSlug}` now shows an invitation-required message and does not accept self-serve email entry.

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | email string | **Required** | Work email (validated but not used for membership) |
| `orgSlug` | string | **Required** | Organization slug |

### Response — `410 Gone`

```json
{
  "success": false,
  "error": {
    "code": "INVITATION_REQUIRED",
    "message": "Open organization join links are no longer supported. Use an invitation link from your administrator."
  }
}
```

### Common errors

| Code | Status | When |
|------|--------|------|
| `INVITATION_REQUIRED` | 410 | Valid body — slug-only self-join disabled |
| `VALIDATION_ERROR` | 400 | Invalid email or slug |

### Legacy post-magic-link flow (removed)

Slug-based magic-link completion (`completeOrganizationJoin`) no longer creates `Member` rows. Approved join-request completion uses `completeJoinWithApprovedRequest()` on `/join/{orgSlug}/complete` when the user is signed in.

---

## POST /api/join/invite/{token}/request-magic-link

**Access:** **Public** (no session)  
**Service:** `validateInvitationForJoin()` + Better Auth `auth.api.signInMagicLink`

Invitee opens `/join/invite/{token}` (token is the invitation UUID). Server validates the invitation is pending and not expired, confirms the submitted email matches the invitation target, and when `Organization.metadata.allowedDomains` is non-empty, rejects emails whose domain is not on the allowlist (secondary check; empty allowlist skips domain enforcement). Then sends a magic link.

Membership is **not** created here — that happens on `/join/invite/{token}/complete` after the user clicks the link.

### Path parameters

| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `token` | UUID string | **Required** | Invitation record id from admin invite email |

### Request body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | email string | **Required** | Must match invitation target email |

```json
{
  "email": "agent@example.com"
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

### Common errors

| Code | Status | When |
|------|--------|------|
| `INVITATION_NOT_FOUND` | 404 | Unknown or malformed token |
| `INVITATION_EXPIRED` | 410 | `expiresAt` is in the past |
| `INVITATION_NOT_PENDING` | 410 | Invitation revoked or already accepted |
| `INVITATION_EMAIL_MISMATCH` | 403 |
| `JOIN_REQUEST_NOT_FOUND` | 404 |
| `JOIN_REQUEST_NOT_PENDING` | 409 |
| `JOIN_REQUEST_ALREADY_PENDING` | 409 |
| `AUTH_REQUIRED` | 401 | Submitted email does not match invitation |
| `RATE_LIMITED` | 429 | Same limits as slug join (IP 10 / 15 min, email 5 / 15 min) |
| `VALIDATION_ERROR` | 400 | Invalid email or token format |

### Post-magic-link flow (not an API route)

```
GET /api/auth/magic-link/verify?token=...&callbackURL=/join/invite/{token}/complete
  → Better Auth creates session (and user if new)
  → Redirect to /join/invite/{token}/complete (server page)
  → completeJoinWithInvitation() / completeInvitationJoin() adds Member row with invitation role
  → redeemInvitation() marks invitation accepted
  → setActiveOrganization
  → Redirect to /employee/track
```

---

## Appendix A — Prisma Tables Referenced

| Table | Model | Used by |
|-------|-------|---------|
| `user` | `User` | Auth, members, time logs |
| `session` | `Session` | Better Auth sessions (`activeOrganizationId`) |
| `organization` | `Organization` | Tenant; `metadata` JSON for join settings + timezone |
| `member` | `Member` | User ↔ org membership and role |
| `activity_status` | `ActivityStatus` | Per-org status definitions |
| `time_log` | `TimeLog` | Clock segments (shift + status history) |
| `invitation` | `Invitation` | Org invitations (`id` is redemption token; status, expiresAt) |
| `join_request` | `JoinRequest` | Queued self-serve join requests (`PENDING` / `APPROVED` / `DENIED`) |

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
| `GET` | `/api/organization/team` | Admin | `getTeamForAdmin` |
| `GET` | `/api/organization/settings` | Admin | `getOrganizationSettingsForAdmin` |
| `PATCH` | `/api/organization/settings` | Admin | `updateOrganizationSettings` |
| `PATCH` | `/api/organization/members/[memberId]/role` | Admin | `updateMemberRoleForAdmin` |
| `GET` | `/api/organization/join-settings` | Admin | `getJoinSettingsForAdmin` |
| `PATCH` | `/api/organization/join-settings` | Admin | `updateJoinSettings` |
| `GET` | `/api/organization/join-requests` | Admin | `listJoinRequestsForAdmin` |
| `POST` | `/api/organization/join-requests/[id]/approve` | Admin | `approveJoinRequest` |
| `POST` | `/api/organization/join-requests/[id]/deny` | Admin | `denyJoinRequest` |
| `POST` | `/api/organization/invitations` | Admin | `createInvitationForAdmin` |
| `GET` | `/api/organization/invitations` | Admin | `listPendingInvitationsForAdmin` |
| `DELETE` | `/api/organization/invitations/{id}` | Admin | `revokeInvitationForAdmin` |
| `POST` | `/api/join/request` | Public / optional session | `submitJoinRequest` |
| `POST` | `/api/join/request-magic-link` | Public | **Deprecated** — returns `INVITATION_REQUIRED` (410) |
| `POST` | `/api/join/invite/{token}/request-magic-link` | Public | `validateInvitationForJoin` + `signInMagicLink` |

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
| Join logic | `lib/services/join.service.ts`, `lib/services/join-request.service.ts`, `lib/organization/metadata.ts` |
| Team / roles | `lib/services/organization-team.service.ts`, `lib/organization/roles.ts` |
| Tests | `vitest.config.ts`, `lib/**/__tests__/*.test.ts`, `test/fixtures/` |
| Validation | `lib/validators/time-tracking.ts`, `admin.ts`, `join.ts` |
| Error codes | `lib/errors/time-tracking.ts`, `lib/errors/join.ts` |
| Client fetch | `lib/api.ts` |
| Response envelope | `lib/http/api-handler.ts` |
