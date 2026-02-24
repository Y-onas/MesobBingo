-- Migration: Add withdrawable_balance and playing_balance columns
-- This implements the withdrawal rules system where only winnings can be withdrawn

-- Add new balance columns
ALTER TABLE users ADD COLUMN withdrawable_balance NUMERIC(12,2) DEFAULT 0 NOT NULL;
ALTER TABLE users ADD COLUMN playing_balance NUMERIC(12,2) DEFAULT 0 NOT NULL;

-- Add tracking column for total winnings
ALTER TABLE users ADD COLUMN total_winnings NUMERIC(12,2) DEFAULT 0 NOT NULL;

-- Migrate existing data (Option A - grandfather existing users)
-- Existing main_wallet → withdrawable_balance (don't penalize existing users)
-- Existing play_wallet → playing_balance
-- Existing main_wallet → total_winnings (backfill historical winnings)
UPDATE users SET 
  withdrawable_balance = main_wallet,
  playing_balance = play_wallet,
  total_winnings = main_wallet;

-- Note: We keep main_wallet and play_wallet columns for backward compatibility
-- They will be deprecated gradually
