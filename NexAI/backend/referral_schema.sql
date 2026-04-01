-- Add to existing nexai database
-- Run: psql -U postgres -d nexai -f referral_schema.sql

CREATE TYPE referral_status AS ENUM ('PENDING', 'ARRIVED', 'NOT_ARRIVED');

CREATE TABLE IF NOT EXISTS referrals (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    referred_to VARCHAR(255) NOT NULL,
    reason TEXT NOT NULL,
    referral_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status referral_status NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_date ON referrals(referral_date DESC);
