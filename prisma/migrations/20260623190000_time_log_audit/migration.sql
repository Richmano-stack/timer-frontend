-- CreateTable
CREATE TABLE "time_log_audit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "timeLogId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_log_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_log_audit_organizationId_timeLogId_idx" ON "time_log_audit"("organizationId", "timeLogId");

-- CreateIndex
CREATE INDEX "time_log_audit_timeLogId_createdAt_idx" ON "time_log_audit"("timeLogId", "createdAt");

-- AddForeignKey
ALTER TABLE "time_log_audit" ADD CONSTRAINT "time_log_audit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_log_audit" ADD CONSTRAINT "time_log_audit_timeLogId_fkey" FOREIGN KEY ("timeLogId") REFERENCES "time_log"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_log_audit" ADD CONSTRAINT "time_log_audit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
