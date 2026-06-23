-- Drop existing RLS policies on users table
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_insert_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;

-- Create new policies that work with custom auth (allow all for this app)
CREATE POLICY "users_select_all" ON users FOR SELECT
  USING (true);

CREATE POLICY "users_insert_all" ON users FOR INSERT
  WITH CHECK (true);

CREATE POLICY "users_update_all" ON users FOR UPDATE
  USING (true);

CREATE POLICY "users_delete_all" ON users FOR DELETE
  USING (true);