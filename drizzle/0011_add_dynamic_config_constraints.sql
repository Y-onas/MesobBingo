-- ─── Add CHECK Constraints to Dynamic Config ──────────────────────
-- Migration: 0011
-- Adds CHECK constraints to enforce valid value_type and category values
-- Adds triggers to auto-update updated_at timestamps
-- Prevents data corruption from invalid values at the database level
-- ────────────────────────────────────────────────────────────────────

-- Add CHECK constraint for value_type
ALTER TABLE system_config
ADD CONSTRAINT chk_value_type CHECK (value_type IN ('string', 'number', 'boolean', 'json'));

-- Add CHECK constraint for category
ALTER TABLE system_config
ADD CONSTRAINT chk_category CHECK (category IN ('payment', 'limits', 'bonuses', 'game', 'features', 'messages'));

-- Add CHECK constraint for payment_accounts provider
ALTER TABLE payment_accounts
ADD CONSTRAINT chk_provider CHECK (provider IN ('telebirr', 'cbe'));

-- ─── Auto-update updated_at Triggers ───────────────────────────────

-- Create reusable function to set updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for system_config (renamed from dynamic_config in schema)
CREATE TRIGGER trg_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger for referral_tiers
CREATE TRIGGER trg_referral_tiers_updated_at
  BEFORE UPDATE ON referral_tiers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Trigger for payment_accounts
CREATE TRIGGER trg_payment_accounts_updated_at
  BEFORE UPDATE ON payment_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
