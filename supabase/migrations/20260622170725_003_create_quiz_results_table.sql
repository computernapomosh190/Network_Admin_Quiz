CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 35,
  percentage DECIMAL(5,2) NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  finished_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  answers JSONB DEFAULT '{}'
);

CREATE INDEX idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX idx_quiz_results_score ON quiz_results(score DESC);
CREATE INDEX idx_quiz_results_finished ON quiz_results(finished_at DESC);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quiz_results_select_own" ON quiz_results FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "quiz_results_insert_own" ON quiz_results FOR INSERT
  TO authenticated WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "quiz_results_update_admin" ON quiz_results FOR UPDATE
  TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "quiz_results_delete_admin" ON quiz_results FOR DELETE
  TO authenticated USING (auth.jwt() ->> 'role' = 'admin');