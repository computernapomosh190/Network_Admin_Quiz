CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_result_id UUID REFERENCES quiz_results(id) ON DELETE SET NULL,
  place INTEGER NOT NULL CHECK (place BETWEEN 1 AND 3),
  certificate_number VARCHAR(50) UNIQUE NOT NULL,
  verification_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_certificates_verification ON certificates(verification_code);

ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certificates_select_own" ON certificates FOR SELECT
  TO authenticated USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "certificates_insert_admin" ON certificates FOR INSERT
  TO authenticated WITH CHECK (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "certificates_delete_admin" ON certificates FOR DELETE
  TO authenticated USING (auth.jwt() ->> 'role' = 'admin');