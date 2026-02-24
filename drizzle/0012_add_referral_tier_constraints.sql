-- ─── Add Validation Constraints to Referral Tiers ─────────────────
-- Migration: 0012
-- Adds CHECK constraints to prevent invalid tier configurations
-- Ensures max_deposit > min_deposit and bonus_amount > 0
-- ────────────────────────────────────────────────────────────────────

-- Add CHECK constraint to ensure max_deposit > min_deposit when max_deposit is not NULL
ALTER TABLE referral_tiers
ADD CONSTRAINT chk_max_greater_than_min 
CHECK (max_deposit IS NULL OR max_deposit > min_deposit);

-- Add CHECK constraint to ensure bonus_amount is positive
ALTER TABLE referral_tiers
ADD CONSTRAINT chk_bonus_positive 
CHECK (bonus_amount > 0);

-- Add CHECK constraint to ensure min_deposit is non-negative
ALTER TABLE referral_tiers
ADD CONSTRAINT chk_min_deposit_non_negative 
CHECK (min_deposit >= 0);
