-- supabase/migrations/004_expense_claims.sql
-- Tracks monthly personal/work expense totals after Dulce's review session
CREATE TABLE IF NOT EXISTS expense_claims (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period               text        NOT NULL,
  total_personal       numeric     NOT NULL DEFAULT 0,
  total_work           numeric     NOT NULL DEFAULT 0,
  personal_actioned_at timestamptz,
  work_actioned_at     timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period)
);

ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read expense_claims"
  ON expense_claims FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert expense_claims"
  ON expense_claims FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated update expense_claims"
  ON expense_claims FOR UPDATE TO authenticated USING (true);
