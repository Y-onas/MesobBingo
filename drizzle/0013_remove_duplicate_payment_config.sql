-- ─── Remove Duplicate Payment Account Configuration ──────────────────
-- Migration: 0013
-- Removes telebirr_number and cbe_account from system_config
-- These values are now managed exclusively in payment_accounts table
-- Prevents data inconsistency from duplicate source of truth
-- ────────────────────────────────────────────────────────────────────

-- Remove telebirr_number from system_config (now in payment_accounts)
DELETE FROM system_config WHERE config_key = 'telebirr_number';

-- Remove cbe_account from system_config (now in payment_accounts)
DELETE FROM system_config WHERE config_key = 'cbe_account';

-- Note: All payment account numbers should now be managed via payment_accounts table
-- Use configService.getActiveAccount(provider) to retrieve account details
