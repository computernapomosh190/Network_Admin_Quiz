CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question TEXT NOT NULL,
  question_type VARCHAR(30) NOT NULL CHECK (question_type IN ('single', 'multiple', 'matching', 'true_false', 'practical')),
  options JSONB NOT NULL,
  correct_answers JSONB NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "questions_select_all" ON questions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "questions_insert_admin" ON questions FOR INSERT
  TO authenticated WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "questions_update_admin" ON questions FOR UPDATE
  TO authenticated USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "questions_delete_admin" ON questions FOR DELETE
  TO authenticated USING (auth.jwt() ->> 'role' = 'admin');