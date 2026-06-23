-- TKT-208: Active connection heartbeat — nullable lastSeenAt on member (null = never seen).

ALTER TABLE "member" ADD COLUMN "lastSeenAt" TIMESTAMPTZ(3);
