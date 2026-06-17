-- Phase 2: Report System
CREATE TABLE IF NOT EXISTS "Report" (
  "id"           TEXT PRIMARY KEY DEFAULT (concat('r_', gen_random_uuid()::text)),
  "reporterId"   TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "targetType"   TEXT NOT NULL,
  "targetId"     TEXT NOT NULL,
  "reason"       TEXT NOT NULL,
  "description"  TEXT,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "resolvedAt"   TIMESTAMPTZ,
  "resolvedById" TEXT REFERENCES "User"("id")
);

CREATE INDEX IF NOT EXISTS "idx_report_status_time" ON "Report"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_report_target" ON "Report"("targetType", "targetId");
