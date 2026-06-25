-- Add attempts_remaining column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS attempts_remaining INTEGER NOT NULL DEFAULT 1;

-- Existing users who already completed the quiz get 0 attempts
UPDATE users u
SET attempts_remaining = 0
WHERE EXISTS (
  SELECT 1 FROM quiz_results qr WHERE qr.user_id = u.id
);
