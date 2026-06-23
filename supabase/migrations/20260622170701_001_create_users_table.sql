CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surname VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  patronymic VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON users FOR SELECT
  TO authenticated USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "users_insert_own" ON users FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "users_update_own" ON users FOR UPDATE
  TO authenticated USING (auth.uid()::text = id::text);

CREATE POLICY "users_delete_admin" ON users FOR DELETE
  TO authenticated USING (auth.jwt() ->> 'role' = 'admin');