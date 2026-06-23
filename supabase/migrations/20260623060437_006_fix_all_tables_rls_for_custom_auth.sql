-- Fix questions table RLS
DROP POLICY IF EXISTS "questions_select_all" ON questions;
DROP POLICY IF EXISTS "questions_insert_admin" ON questions;
DROP POLICY IF EXISTS "questions_update_admin" ON questions;
DROP POLICY IF EXISTS "questions_delete_admin" ON questions;

CREATE POLICY "questions_select_all" ON questions FOR SELECT USING (true);
CREATE POLICY "questions_insert_all" ON questions FOR INSERT WITH CHECK (true);
CREATE POLICY "questions_update_all" ON questions FOR UPDATE USING (true);
CREATE POLICY "questions_delete_all" ON questions FOR DELETE USING (true);

-- Fix quiz_results table RLS
DROP POLICY IF EXISTS "quiz_results_select_own" ON quiz_results;
DROP POLICY IF EXISTS "quiz_results_insert_own" ON quiz_results;
DROP POLICY IF EXISTS "quiz_results_update_own" ON quiz_results;
DROP POLICY IF EXISTS "quiz_results_delete_admin" ON quiz_results;
DROP POLICY IF EXISTS "results_select_own" ON quiz_results;
DROP POLICY IF EXISTS "results_insert_own" ON quiz_results;
DROP POLICY IF EXISTS "results_update_admin" ON quiz_results;
DROP POLICY IF EXISTS "results_delete_admin" ON quiz_results;

CREATE POLICY "quiz_results_select_all" ON quiz_results FOR SELECT USING (true);
CREATE POLICY "quiz_results_insert_all" ON quiz_results FOR INSERT WITH CHECK (true);
CREATE POLICY "quiz_results_update_all" ON quiz_results FOR UPDATE USING (true);
CREATE POLICY "quiz_results_delete_all" ON quiz_results FOR DELETE USING (true);

-- Fix certificates table RLS
DROP POLICY IF EXISTS "certificates_select_own" ON certificates;
DROP POLICY IF EXISTS "certificates_insert_own" ON certificates;
DROP POLICY IF EXISTS "certificates_update_admin" ON certificates;
DROP POLICY IF EXISTS "certificates_delete_admin" ON certificates;
DROP POLICY IF EXISTS "cert_select_own" ON certificates;
DROP POLICY IF EXISTS "cert_insert_own" ON certificates;

CREATE POLICY "certificates_select_all" ON certificates FOR SELECT USING (true);
CREATE POLICY "certificates_insert_all" ON certificates FOR INSERT WITH CHECK (true);
CREATE POLICY "certificates_update_all" ON certificates FOR UPDATE USING (true);
CREATE POLICY "certificates_delete_all" ON certificates FOR DELETE USING (true);