# API Reference — Timer Frontend (Time Tracking)

> **Generated from static analysis of** `app/api/**/*` **and downstream service/validation layers.**  
> **Last scanned routes:** 6 endpoints (4 time + 2 admin)  
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

Verified `userId` / `companyId` values from tenant resolution are used for all subsequent Prisma queries.

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

## GET /api/time/my-day

### 1. OVERVIEW

- **Description:** Returns an employee's day view: active session (if any), company activity statuses, shift rows (`TimeLog`), activity rows (`ActivityLog`), timeline, and summary. Closed shifts are filtered by `date`; an **open shift is always included in full** from `clockIn` through now, even when `clockIn` falls on a prior calendar day (overnight shifts).
- **Access Control:** **Public (MVP)** — caller supplies `userId`, `companyId`, and optional `date` as query parameters.
- **Database operations:**
  - **Read:** `User`, `ActivityStatus`, `TimeLog` (filtered by date range, plus open shift merge), nested `ActivityLog`, open session lookup
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

When clocked in, `activeSession` contains the open `TimeLog` and any open `ActivityLog`. Use this endpoint as the **canonical read** for current session state (replaces the removed `/api/time/active`). Admin agent drill-down also uses this endpoint with any `userId`.

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

## Appendix A — Prisma Tables Referenced

| Table | Model | Used By |
|-------|-------|---------|
| `User` | `User` | All endpoints (tenant check) |
| `TimeLog` | `TimeLog` | All time endpoints; admin overview & timesheets |
| `ActivityStatus` | `ActivityStatus` | Status switch (read), company status catalog |
| `ActivityLog` | `ActivityLog` | Status switch, clock-out (update), my-day (read) |
| `Company` | `Company` | Indirect via foreign keys on `User` / `TimeLog` / `ActivityStatus` |

---

## Appendix B — Route Inventory

| Method | Path | Handler Export | Service Function |
|--------|------|----------------|------------------|
| `POST` | `/api/time/clock-in` | `POST` | `clockInService` |
| `POST` | `/api/time/clock-out` | `POST` | `clockOutService` |
| `POST` | `/api/time/status` | `POST` | `setStatusService` |
| `GET` | `/api/time/my-day` | `GET` | `getMyDayService` |
| `GET` | `/api/admin/overview` | `GET` | `getAdminOverviewService` |
| `GET` | `/api/admin/timesheets` | `GET` | `getTimesheetsService` |

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
