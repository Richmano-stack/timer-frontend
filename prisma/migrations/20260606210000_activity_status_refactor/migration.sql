-- CreateTable
CREATE TABLE "ActivityStatus" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isProductive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActivityStatus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityStatus_companyId_name_key" ON "ActivityStatus"("companyId", "name");
CREATE INDEX "ActivityStatus_companyId_idx" ON "ActivityStatus"("companyId");

ALTER TABLE "ActivityStatus" ADD CONSTRAINT "ActivityStatus_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ActivityStatus" ("id", "companyId", "name", "isProductive", "createdAt", "updatedAt")
VALUES
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000010', 'Lunch', false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000010', 'Short Break', true, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000010', 'Meeting', true, NOW(), NOW());

ALTER TABLE "BreakLog" RENAME TO "ActivityLog";

ALTER TABLE "ActivityLog" ADD COLUMN "statusId" TEXT;

UPDATE "ActivityLog" al
SET "statusId" = (
  CASE al."breakType"::text
    WHEN 'LUNCH' THEN '00000000-0000-4000-8000-000000000101'
    WHEN 'SHORT_BREAK' THEN '00000000-0000-4000-8000-000000000102'
    WHEN 'MEDICAL' THEN '00000000-0000-4000-8000-000000000103'
    ELSE '00000000-0000-4000-8000-000000000101'
  END
);

ALTER TABLE "ActivityLog" ALTER COLUMN "statusId" SET NOT NULL;

ALTER TABLE "ActivityLog" DROP COLUMN "breakType";

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ActivityStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER INDEX "BreakLog_timeLogId_endTime_idx" RENAME TO "ActivityLog_timeLogId_endTime_idx";

DROP TYPE "BreakType";
