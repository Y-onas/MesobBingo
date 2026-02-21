-- Migration: Add pause tracking fields to games table
-- Purpose: Track game pause state for disconnect/reconnect feature
-- Date: 2026-02-21

-- Add columns with IF NOT EXISTS for idempotency
DO $$ 
BEGIN
  -- Add paused column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'paused'
  ) THEN
    ALTER TABLE games ADD COLUMN paused BOOLEAN DEFAULT FALSE NOT NULL;
  END IF;

  -- Add paused_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'paused_at'
  ) THEN
    ALTER TABLE games ADD COLUMN paused_at TIMESTAMP;
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'notes'
  ) THEN
    ALTER TABLE games ADD COLUMN notes TEXT;
  END IF;
END $$;

-- Add index for querying paused games (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_games_paused ON games(paused) WHERE paused = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN games.paused IS 'Whether game is paused due to all players disconnecting';
COMMENT ON COLUMN games.paused_at IS 'Timestamp when game was paused';
COMMENT ON COLUMN games.notes IS 'Additional notes about game state (e.g., house win reason)';
