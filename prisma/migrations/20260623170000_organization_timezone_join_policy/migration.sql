-- TKT-201: Promote timezone and join policy from Organization.metadata JSON to first-class columns.
-- JoinPolicy mapping from metadata.requireApproval:
--   true  → DOMAIN_APPROVAL (domain join requires admin approval)
--   false → DOMAIN_AUTO     (domain join auto-approved when authenticated)
--   absent → INVITE_ONLY    (invitation-only; default for existing orgs without self-serve)

-- CreateEnum
CREATE TYPE "JoinPolicy" AS ENUM ('INVITE_ONLY', 'DOMAIN_APPROVAL', 'DOMAIN_AUTO');

-- AlterTable: add nullable columns first for safe backfill
ALTER TABLE "organization" ADD COLUMN "timezone" TEXT;
ALTER TABLE "organization" ADD COLUMN "joinPolicy" "JoinPolicy";

-- Backfill timezone from metadata JSON (fallback UTC)
UPDATE "organization"
SET "timezone" = COALESCE(
  NULLIF(TRIM("metadata"::jsonb->>'timezone'), ''),
  'UTC'
);

-- Backfill joinPolicy from metadata.requireApproval
UPDATE "organization"
SET "joinPolicy" = CASE
  WHEN ("metadata"::jsonb->>'requireApproval')::boolean IS TRUE THEN 'DOMAIN_APPROVAL'::"JoinPolicy"
  WHEN ("metadata"::jsonb->>'requireApproval')::boolean IS FALSE THEN 'DOMAIN_AUTO'::"JoinPolicy"
  ELSE 'INVITE_ONLY'::"JoinPolicy"
END;

-- Enforce NOT NULL and defaults for new rows
ALTER TABLE "organization" ALTER COLUMN "timezone" SET DEFAULT 'UTC';
ALTER TABLE "organization" ALTER COLUMN "timezone" SET NOT NULL;
ALTER TABLE "organization" ALTER COLUMN "joinPolicy" SET DEFAULT 'INVITE_ONLY';
ALTER TABLE "organization" ALTER COLUMN "joinPolicy" SET NOT NULL;
