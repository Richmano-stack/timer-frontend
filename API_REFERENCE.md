# API Reference — Timer Frontend (Time Tracking)

> **Generated from static analysis of** `app/api/**/*` **and downstream service/validation layers.**  
> **Last scanned routes:** 6 endpoints under `app/api/time/`  
> **Base URL (local dev):** `http://localhost:3000`

---

## Global Conventions

### Response Envelope

Every route handler returns JSON using this envelope (via `lib/http/api-handler.ts`):

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

### Authentication & Authorization

| Item | Current Implementation |
|------|------------------------|
| Middleware | **None** — no `middleware.ts` exists in this repository |
| Session / Bearer token | **Not enforced** on any time-tracking route |
| Identity source | `userId` and `companyId` are supplied by the **client** in the JSON request body (POST) or query string (GET) |
| Role checks | **None** — `UserRole` enum exists in Prisma but is not checked by route handlers |

**Access control classification for all endpoints below:** **Public (MVP / dev identity in request)** — any caller who knows a valid `userId` + `companyId` pair can invoke these routes.

### Content Type

All POST endpoints expect:

```
Content-Type: application/json
```

### Timestamps

All `DateTime` fields returned from the service layer are serialized to **ISO 8601 UTC strings** (e.g. `"2026-06-06T12:40:25.170Z"`) via `lib/utils/time.ts`.

`latitude` and `longitude` on `TimeLog` responses are serialized as **strings** (Prisma `Decimal` → `String()`).

### Error Code → HTTP Status Mapping

Defined in `lib/http/api-handler.ts`:

| Error Code | HTTP Status |
|------------|-------------|
| `VALIDATION_ERROR` | 400 |
| `USER_NOT_IN_COMPANY` | 403 |
| `NO_ACTIVE_SESSION_FOUND` | 404 |
| `TIMELOG_NOT_FOUND` | 404 |
| `ACTIVITY_STATUS_NOT_FOUND` | 404 |
| `NO_ACTIVE_BREAK_FOUND` | 404 |
| `USER_ALREADY_CLOCKED_IN` | 409 |
| `BREAK_ALREADY_ACTIVE` | 409 |
| `INTERNAL_SERVER_ERROR` | 500 |
| Unknown error codes | 400 (fallback) |

### Tenant Isolation

All time-tracking services resolve identity through `lib/security/tenant-context.ts`:

1. **`resolveTenantContext(userId, companyId)`** — verifies an active `User` row exists for the pair before any tenant-scoped operation proceeds. Returns `403 USER_NOT_IN_COMPANY` on mismatch.
2. **`assertTimeLogTenantScope(timeLogId, tenant)`** — ensures a `TimeLog` belongs to the verified user and company before break mutations. Returns `404 TIMELOG_NOT_FOUND` when the resource is outside tenant scope.

Verified `userId` / `companyId` values from tenant resolution are used for all subsequent Prisma queries — never raw client identifiers alone.

### Unhandled Server Errors (500)

Service execution is wrapped by `executeServiceRoute()` in `lib/http/api-handler.ts`. Uncaught Prisma/runtime faults are logged server-side and returned as:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

Raw database stack traces are **not** exposed to clients.

---

## POST /api/time/clock-in

### 1. OVERVIEW

- **Description:** Starts a new active work session by creating a `TimeLog` row for a user within a company, rejecting the operation if the user already has an open session (`clockOut IS NULL`).
- **Access Control:** **Public (MVP)** — no authentication middleware; caller supplies `userId` and `companyId` in the JSON body.
- **Database operations:**
  - **Read:** `User` (membership check), `TimeLog` (active session lookup)
  - **Write:** **Creates** a row in the **`TimeLog`** table

**Source files:** `app/api/time/clock-in/route.ts` → `clockInService()` in `lib/services/time-tracking.service.ts`

---

### 2. REQUEST PARAMETERS

#### URL / Query Parameters

None.

#### Request Body Payload (`JSON`)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `userId` | `string` (UUID) | **Required** | Must be valid UUID (`z.string().uuid()`) | Must match an existing `User.id` |
| `companyId` | `string` (UUID) | **Required** | Must be valid UUID | User must belong to this company |
| `clockInIp` | `string` \| `null` | Optional | — | Stored on `TimeLog.clockInIp`; defaults to `null` |
| `latitude` | `number` \| `null` | Optional | — | Stored as `Decimal(10,8)`; defaults to `null` |
| `longitude` | `number` \| `null` | Optional | — | Stored as `Decimal(11,8)`; defaults to `null` |
| `notes` | `string` | Optional | — | Defaults to `""` if omitted |

**Example request:**

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "companyId": "00000000-0000-4000-8000-000000000010",
  "clockInIp": "192.168.1.10",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "notes": "Started shift"
}
```

---

### 3. RESPONSE MATRIX

#### Success Response — `200 OK`

`clockIn` timestamp is set server-side to `utcNow()` at insert time.

```json
{
  "success": true,
  "data": {
    "timeLog": {
      "id": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
      "userId": "00000000-0000-4000-8000-000000000001",
      "companyId": "00000000-0000-4000-8000-000000000010",
      "clockIn": "2026-06-06T12:40:25.170Z",
      "clockOut": null,
      "clockInIp": "192.168.1.10",
      "clockOutIp": null,
      "latitude": "40.7128",
      "longitude": "-74.006",
      "notes": "Started shift",
      "createdAt": "2026-06-06T12:40:25.177Z",
      "updatedAt": "2026-06-06T12:40:25.177Z"
    }
  }
}
```

#### Error Responses

**400 Bad Request — Invalid JSON body**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body must be valid JSON."
  }
}
```

**400 Bad Request — Zod schema failure** (invalid UUID, wrong types, etc.)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid UUID"
  }
}
```

> Multiple Zod issues are joined with `"; "` in the `message` field.

**403 Forbidden — User not in company**

Triggered when no `User` row exists with `{ id: userId, companyId: companyId }`.

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_IN_COMPANY",
    "message": "User does not belong to the specified company."
  }
}
```

**409 Conflict — Already clocked in**

Triggered when a `TimeLog` exists for the user/company with `clockOut: null`.

```json
{
  "success": false,
  "error": {
    "code": "USER_ALREADY_CLOCKED_IN",
    "message": "User already has an active clock-in session."
  }
}
```

**500 Internal Server Error**

Uncaught Prisma/database errors are intercepted by `executeServiceRoute()`:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

---

## POST /api/time/clock-out

### 1. OVERVIEW

- **Description:** Closes the user's single active `TimeLog` session by setting `clockOut`, and atomically closes any open `ActivityLog` rows (`endTime IS NULL`) on that session inside a database transaction.
- **Access Control:** **Public (MVP)** — caller supplies `userId` and `companyId` in the JSON body.
- **Database operations:**
  - **Read:** `TimeLog` (active session lookup)
  - **Write (transaction):**
    - **Updates** all open rows in **`ActivityLog`** for the active `timeLogId` (`endTime` set to server UTC now)
    - **Computes** server-authoritative `netWorkMinutes` (gross elapsed minus break duration) from persisted DB timestamps via `computeNetWorkMinutes()` in `lib/utils/time.ts`
    - **Updates** the active row in **`TimeLog`** (`clockOut`, optional `clockOutIp`, locked `netWorkMinutes`)

**Source files:** `app/api/time/clock-out/route.ts` → `clockOutService()` in `lib/services/time-tracking.service.ts`

---

### 2. REQUEST PARAMETERS

#### URL / Query Parameters

None.

#### Request Body Payload (`JSON`)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `userId` | `string` (UUID) | **Required** | Valid UUID | Used to locate active session |
| `companyId` | `string` (UUID) | **Required** | Valid UUID | Scoped with `userId` |
| `clockOutIp` | `string` \| `null` | Optional | — | Stored on `TimeLog.clockOutIp`; defaults to `null` |

**Example request:**

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "companyId": "00000000-0000-4000-8000-000000000010",
  "clockOutIp": "192.168.1.10"
}
```

---

### 3. RESPONSE MATRIX

#### Success Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "timeLog": {
      "id": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
      "userId": "00000000-0000-4000-8000-000000000001",
      "companyId": "00000000-0000-4000-8000-000000000010",
      "clockIn": "2026-06-06T12:40:25.170Z",
      "clockOut": "2026-06-06T12:41:22.853Z",
      "netWorkMinutes": 0,
      "clockInIp": null,
      "clockOutIp": "192.168.1.10",
      "latitude": null,
      "longitude": null,
      "notes": "",
      "createdAt": "2026-06-06T12:40:25.177Z",
      "updatedAt": "2026-06-06T12:41:22.912Z"
    }
  }
}
```

#### Error Responses

**400 Bad Request — Invalid JSON**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body must be valid JSON."
  }
}
```

**400 Bad Request — Zod validation failure**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid UUID"
  }
}
```

**404 Not Found — No active session**

Triggered when no `TimeLog` exists with `{ userId, companyId, clockOut: null }`.

```json
{
  "success": false,
  "error": {
    "code": "NO_ACTIVE_SESSION_FOUND",
    "message": "No active clock-in session found for this user."
  }
}
```

**500 Internal Server Error**

Uncaught Prisma/transaction errors are intercepted by `executeServiceRoute()`:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

---

## POST /api/time/break

### 1. OVERVIEW

- **Description:** Starts or ends an activity sub-session on an open `TimeLog` — `START` creates an `ActivityLog` row bound to a company-specific `ActivityStatus`; `END` closes the currently open activity by setting `endTime`.
- **Access Control:** **Public (MVP)** — no session/token validation. `userId` and `companyId` are verified via `resolveTenantContext()` and the target `TimeLog` is scoped with `assertTimeLogTenantScope()` before any activity mutation.
- **Database operations:**
  - **Read:** `TimeLog` (existence + open check), `ActivityStatus` (lookup by `statusId` or `name` + `companyId`), `ActivityLog` (open activity lookup)
  - **Write (`START`):** **Creates** a row in **`ActivityLog`** with resolved `statusId`
  - **Write (`END`):** **Updates** the open row in **`ActivityLog`** (`endTime` set to server UTC now)

**Source files:** `app/api/time/break/route.ts` → `manageBreakService()` in `lib/services/time-tracking.service.ts`

---

### 2. REQUEST PARAMETERS

#### URL / Query Parameters

None.

#### Request Body Payload (`JSON`)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `userId` | `string` (UUID) | **Required** | Valid UUID | Verified against company membership |
| `companyId` | `string` (UUID) | **Required** | Valid UUID | Tenant scope for the operation |
| `timeLogId` | `string` (UUID) | **Required** | Valid UUID | Target open `TimeLog.id` |
| `action` | `"START"` \| `"END"` | **Required** | Enum | Determines operation |
| `statusId` | `string` (UUID) | **Required on START when `statusName` omitted** | Valid UUID | Must belong to the requester's `companyId` |
| `statusName` | `string` | **Required on START when `statusId` omitted** | Non-empty trim | Exact match against `ActivityStatus.name` for the company |

**Example — start activity by name:**

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "companyId": "00000000-0000-4000-8000-000000000010",
  "timeLogId": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
  "action": "START",
  "statusName": "Lunch"
}
```

**Example — start activity by id:**

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "companyId": "00000000-0000-4000-8000-000000000010",
  "timeLogId": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
  "action": "START",
  "statusId": "00000000-0000-4000-8000-000000000101"
}
```

**Example — end activity:**

```json
{
  "userId": "00000000-0000-4000-8000-000000000001",
  "companyId": "00000000-0000-4000-8000-000000000010",
  "timeLogId": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
  "action": "END"
}
```

---

### 3. RESPONSE MATRIX

#### Success Response — `200 OK` (START)

```json
{
  "success": true,
  "data": {
    "activityLog": {
      "id": "79c9dbf4-b74c-48d5-9164-7f60024de7d6",
      "timeLogId": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
      "statusId": "00000000-0000-4000-8000-000000000101",
      "statusName": "Lunch",
      "isProductive": false,
      "startTime": "2026-06-06T12:41:05.624Z",
      "endTime": null,
      "createdAt": "2026-06-06T12:41:05.654Z",
      "updatedAt": "2026-06-06T12:41:05.654Z"
    }
  }
}
```

#### Success Response — `200 OK` (END)

```json
{
  "success": true,
  "data": {
    "activityLog": {
      "id": "79c9dbf4-b74c-48d5-9164-7f60024de7d6",
      "timeLogId": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
      "statusId": "00000000-0000-4000-8000-000000000101",
      "statusName": "Lunch",
      "isProductive": false,
      "startTime": "2026-06-06T12:41:05.624Z",
      "endTime": "2026-06-06T12:45:00.000Z",
      "createdAt": "2026-06-06T12:41:05.654Z",
      "updatedAt": "2026-06-06T12:45:00.012Z"
    }
  }
}
```

#### Error Responses

**400 Bad Request — Invalid JSON**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body must be valid JSON."
  }
}
```

**400 Bad Request — Zod validation (missing `type` on START)**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "type is required when action is START"
  }
}
```

**400 Bad Request — Service-level missing type on START** (defensive path if Zod bypassed)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Break type is required when starting a break."
  }
}
```

**404 Not Found — Time log does not exist**

```json
{
  "success": false,
  "error": {
    "code": "TIMELOG_NOT_FOUND",
    "message": "Time log not found."
  }
}
```

**404 Not Found — Time log already closed**

```json
{
  "success": false,
  "error": {
    "code": "NO_ACTIVE_SESSION_FOUND",
    "message": "Cannot manage breaks on a closed time log."
  }
}
```

**404 Not Found — END with no open break**

```json
{
  "success": false,
  "error": {
    "code": "NO_ACTIVE_BREAK_FOUND",
    "message": "No active break found to close."
  }
}
```

**409 Conflict — START while break already open**

```json
{
  "success": false,
  "error": {
    "code": "BREAK_ALREADY_ACTIVE",
    "message": "An active break is already running for this time log."
  }
}
```

**500 Internal Server Error**

Uncaught Prisma errors are intercepted by `executeServiceRoute()`:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

---

---

## GET /api/time/my-day

### 1. OVERVIEW

- **Description:** Returns an employee's day view: active session (if any), company activity statuses for break actions, today's shift rows (`TimeLog`), and today's activity rows (`ActivityLog`).
- **Access Control:** **Public (MVP)** — caller supplies `userId`, `companyId`, and optional `date` as query parameters.
- **Database operations:**
  - **Read:** `User`, `ActivityStatus`, `TimeLog` (filtered by date range), nested `ActivityLog`, open session lookup
  - **Write:** None

**Source files:** `app/api/time/my-day/route.ts` → `getMyDayService()` in `lib/services/time-tracking.service.ts`

---

### 2. REQUEST PARAMETERS

#### URL / Query Parameters

| Parameter | Type | Required | Validation | Notes |
|-----------|------|----------|------------|-------|
| `userId` | `string` (UUID) | **Required** | Valid UUID | Must match an existing `User.id` |
| `companyId` | `string` (UUID) | **Required** | Valid UUID | User must belong to this company |
| `date` | `string` | Optional | `YYYY-MM-DD` | Defaults to UTC today when omitted |

**Example request:**

```
GET /api/time/my-day?userId=00000000-0000-4000-8000-000000000001&companyId=00000000-0000-4000-8000-000000000010&date=2026-06-06
```

#### Request Body Payload (`JSON`)

None.

---

### 3. RESPONSE MATRIX

#### Success Response — `200 OK`

```json
{
  "success": true,
  "data": {
    "employeeName": "Demo Employee",
    "date": "2026-06-06",
    "activeSession": null,
    "activityStatuses": [
      { "id": "00000000-0000-4000-8000-000000000101", "name": "Lunch", "isProductive": false }
    ],
    "shifts": [],
    "activities": []
  }
}
```

When clocked in, `activeSession` matches the shape returned by `GET /api/time/active`. `shifts` and `activities` contain formatted display fields for the employee dashboard tables.

#### Error Responses

Same envelope as other time routes: `VALIDATION_ERROR` (400), `USER_NOT_IN_COMPANY` (403), `INTERNAL_SERVER_ERROR` (500).

---

## POST /api/time/status

### 1. OVERVIEW

- **Description:** Switches the agent's current status on an open shift. Ends any open activity and optionally starts a new one. Omit `statusId` and `statusName` to return to **Available** (no open activity).
- **Access Control:** **Public (MVP)** — caller supplies `userId` and `companyId` in JSON body.
- **Database operations:**
  - **Read:** tenant scope, active `TimeLog`, `ActivityStatus` (when switching)
  - **Write:** close open `ActivityLog`, create new `ActivityLog` when switching to a status

**Source files:** `app/api/time/status/route.ts` → `setStatusService()` in `lib/services/time-tracking.service.ts`

---

### 2. REQUEST PARAMETERS

#### Request Body Payload (`JSON`)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | UUID | **Required** | Employee id |
| `companyId` | UUID | **Required** | Company id |
| `statusId` | UUID | Optional | Target status; omit both id and name for Available |
| `statusName` | string | Optional | Alternative to `statusId` |

---

## GET /api/time/active

### 1. OVERVIEW

- **Description:** Returns the user's current open work session (`TimeLog` where `clockOut IS NULL`) and any open activity on that session, or `{ session: null }` if the user is clocked out.
- **Access Control:** **Public (MVP)** — caller supplies `userId` and `companyId` as query parameters.
- **Database operations:**
  - **Read:** `User` (membership check), `TimeLog` + nested `ActivityLog` (open activity, `take: 1`) with `ActivityStatus`
  - **Write:** None

**Source files:** `app/api/time/active/route.ts` → `getActiveSessionService()` in `lib/services/time-tracking.service.ts`

---

### 2. REQUEST PARAMETERS

#### URL / Query Parameters

| Parameter | Type | Required | Validation | Notes |
|-----------|------|----------|------------|-------|
| `userId` | `string` (UUID) | **Required** | Valid UUID | Must match an existing `User.id` |
| `companyId` | `string` (UUID) | **Required** | Valid UUID | User must belong to this company |

**Example request:**

```
GET /api/time/active?userId=00000000-0000-4000-8000-000000000001&companyId=00000000-0000-4000-8000-000000000010
```

#### Request Body Payload (`JSON`)

None.

---

### 3. RESPONSE MATRIX

#### Success Response — `200 OK` (active session)

```json
{
  "success": true,
  "data": {
    "session": {
      "timeLog": {
        "id": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
        "userId": "00000000-0000-4000-8000-000000000001",
        "companyId": "00000000-0000-4000-8000-000000000010",
        "clockIn": "2026-06-06T12:40:25.170Z",
        "clockOut": null,
        "clockInIp": null,
        "clockOutIp": null,
        "latitude": null,
        "longitude": null,
        "notes": "",
        "createdAt": "2026-06-06T12:40:25.177Z",
        "updatedAt": "2026-06-06T12:40:25.177Z"
      },
      "activeActivity": {
        "id": "79c9dbf4-b74c-48d5-9164-7f60024de7d6",
        "timeLogId": "381ef1ec-cb55-4cf9-b9cd-5ada183e6bea",
        "statusId": "00000000-0000-4000-8000-000000000101",
        "statusName": "Lunch",
        "isProductive": false,
        "startTime": "2026-06-06T12:41:05.624Z",
        "endTime": null,
        "createdAt": "2026-06-06T12:41:05.654Z",
        "updatedAt": "2026-06-06T12:41:05.654Z"
      }
    }
  }
}
```

When no open activity exists, `activeActivity` is `null`:

```json
{
  "success": true,
  "data": {
    "session": {
      "timeLog": { },
      "activeActivity": null
    }
  }
}
```

#### Success Response — `200 OK` (clocked out)

Not an error — user has no open session:

```json
{
  "success": true,
  "data": {
    "session": null
  }
}
```

#### Error Responses

**400 Bad Request — Missing or invalid query params**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid UUID"
  }
}
```

**403 Forbidden — User not in company**

```json
{
  "success": false,
  "error": {
    "code": "USER_NOT_IN_COMPANY",
    "message": "User does not belong to the specified company."
  }
}
```

**500 Internal Server Error**

Uncaught Prisma errors are intercepted by `executeServiceRoute()`:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please try again later."
  }
}
```

---

## Appendix A — Prisma Tables Referenced

| Table | Model | Used By |
|-------|-------|---------|
| `User` | `User` | Clock-in (read), Active session (read) |
| `TimeLog` | `TimeLog` | All endpoints |
| `ActivityStatus` | `ActivityStatus` | Break START (read), company-scoped status catalog |
| `ActivityLog` | `ActivityLog` | Break, Clock-out (update), Active session (read) |
| `Company` | `Company` | Indirect via foreign keys on `User` / `TimeLog` / `ActivityStatus` |

---

## Appendix B — Route Inventory

| Method | Path | Handler Export | Service Function |
|--------|------|----------------|------------------|
| `POST` | `/api/time/clock-in` | `POST` | `clockInService` |
| `POST` | `/api/time/clock-out` | `POST` | `clockOutService` |
| `POST` | `/api/time/break` | `POST` | `manageBreakService` |
| `POST` | `/api/time/status` | `POST` | `setStatusService` |
| `GET` | `/api/time/my-day` | `GET` | `getMyDayService` |
| `GET` | `/api/time/active` | `GET` | `getActiveSessionService` |

No routes were found under `pages/api/**` or other API directories at time of scan.

---

## Appendix C — Local Testing (Seed Data)

After `pnpm db:seed`, the following dev identity is available (from `.env.example`):

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_DEV_USER_ID` | `00000000-0000-4000-8000-000000000001` |
| `NEXT_PUBLIC_DEV_COMPANY_ID` | `00000000-0000-4000-8000-000000000010` |

**Example curl — clock in:**

```bash
curl -X POST http://localhost:3000/api/time/clock-in \
  -H "Content-Type: application/json" \
  -d '{"userId":"00000000-0000-4000-8000-000000000001","companyId":"00000000-0000-4000-8000-000000000010"}'
```
