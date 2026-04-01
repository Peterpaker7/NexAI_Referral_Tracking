-- NexAI v5 Migration
-- Run: psql -U postgres -d nexai -f migration_v5.sql

-- 1. Add verification fields to visits
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS verified_by VARCHAR(100);

-- 2. Add priority to referrals
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'referral_priority') THEN
    CREATE TYPE referral_priority AS ENUM ('HIGH', 'MEDIUM', 'LOW');
  END IF;
END $$;

ALTER TABLE referrals
  ADD COLUMN IF NOT EXISTS priority referral_priority NOT NULL DEFAULT 'MEDIUM';

-- 3. Indexes for new dashboard queries
CREATE INDEX IF NOT EXISTS idx_visits_verified ON visits(is_verified);
CREATE INDEX IF NOT EXISTS idx_referrals_priority ON referrals(priority);
