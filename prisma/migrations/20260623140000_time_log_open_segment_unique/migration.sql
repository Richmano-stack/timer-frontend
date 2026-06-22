-- Partial unique index: at most one open (endTime IS NULL) segment per user per tenant.
-- Enforced at DB layer to prevent concurrent double clock-in (TKT-109).
CREATE UNIQUE INDEX "time_log_userId_organizationId_open_key"
ON "time_log"("userId", "organizationId")
WHERE "endTime" IS NULL;
