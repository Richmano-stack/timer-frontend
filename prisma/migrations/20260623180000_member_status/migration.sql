-- TKT-203: Soft member deactivation lifecycle (ACTIVE | DEACTIVATED).

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

-- AlterTable: add nullable column first for safe backfill
ALTER TABLE "member" ADD COLUMN "status" "MemberStatus";

-- Backfill existing rows to ACTIVE
UPDATE "member" SET "status" = 'ACTIVE' WHERE "status" IS NULL;

-- Enforce NOT NULL and default for new rows
ALTER TABLE "member" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "member" ALTER COLUMN "status" SET NOT NULL;

-- CreateIndex
CREATE INDEX "member_organizationId_status_idx" ON "member"("organizationId", "status");
