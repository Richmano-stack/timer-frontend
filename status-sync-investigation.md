1. Technical Investigation: Status Sync Lag
Date: 2026-01-27 Status: In Progress (Backend verified, Frontend sync inconsistent)

2. Executive Summary
We successfully migrated the database from Integer IDs to String CUIDs using Drizzle and Better Auth. While the backend logic is now airtight and type-safe, the Frontend UI exhibits "State Lag." The UI occasionally reverts to the previous status or fails to show the active status immediately after a successful API call.

3. The Problem (Root Cause Analysis)
The frontend relies on router.refresh() to update the currentStatus prop. However, we are observing two specific failure points:

Prop Staleness: router.refresh() triggers a re-fetch, but if the Server Component reads from a cached session cookie instead of the live Database, it receives the "old" status.

Logic Mismatch: The client-side "Already in this status" guard was checking against the prop (currentStatus) rather than the optimistic state (activeStatus), causing duplicate requests to hit the server and trigger 400 errors.

4. Work Performed Today
A. Database Reconstruction
Removed the manual initDb function (Split-Brain risk).

Wiped legacy tables and Drizzle metadata to resolve constraint errors.

Executed npx drizzle-kit push to synchronize the new TEXT based ID schema.

B. Controller Refactor
Refactored statusController.ts to use Drizzle Transactions.

Implemented a Server-Side Guard: The API now rejects requests if the user attempts to switch to their already active status.

C. Frontend "Optimistic" Implementation
Introduced activeStatus local state in StatusSwitcher.tsx.

Implemented useEffect to sync the local state when the server prop eventually updates.

Added a rollback mechanism in the catch block to revert the UI if the API fails.

5. What Didn't Work (The "Gotchas")
Direct Prop Checking: Checking newStatus === currentStatus failed because currentStatus doesn't update until the network round-trip and server re-render are complete.

Standard router.refresh(): In Next.js, this doesn't guarantee an immediate update if the data source (Session/Auth) is cached.

6. Action Items for Tonight
Task 1: Fix the Guard Clause
Ensure the StatusSwitcher checks against activeStatus.

TypeScript

if (newStatus === activeStatus) return; // NOT currentStatus
Task 2: Audit the Server Component (page.tsx)
Verify that the parent component is fetching the user's status directly from the DB:

TypeScript

// Don't rely on session.user.currentStatus!
const user = await db.query.user.findFirst({ where: eq(user.id, sessionId) });
Task 3: Tailwind Class Safety
The dynamic split logic ${status.color.split('-')[1]} is dangerous for Tailwind's JIT.

Plan: Update the statuses array to include the full class names for borders and rings to prevent CSS being purged in production.