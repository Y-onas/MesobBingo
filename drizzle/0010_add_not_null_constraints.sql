-- Migration: Add NOT NULL constraints to columns with defaults
-- These columns have default values and should never be NULL

-- System Config table
ALTER TABLE system_config 
  ALTER COLUMN updated_at SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

-- System Config History table
ALTER TABLE system_config_history 
  ALTER COLUMN changed_at SET NOT NULL;

-- Referral Tiers table
ALTER TABLE referral_tiers 
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- Payment Accounts table
ALTER TABLE payment_accounts 
  ALTER COLUMN is_active SET NOT NULL,
  ALTER COLUMN priority SET NOT NULL,
  ALTER COLUMN current_daily_total SET NOT NULL,
  ALTER COLUMN last_reset_date SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;
