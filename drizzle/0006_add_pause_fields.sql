-- Migration: Add pause tracking fields to games table
-- Purpose: Track game pause state for disconnect/reconnect feature
-- Date: 2026-02-21

ALTER TABLE games 
ADD COLUMN paused BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN paused_at TIMESTAMP,
ADD COLUMN notes TEXT;

-- Add index for querying paused games
CREATE INDEX idx_games_paused ON games(paused) WHERE paused = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN games.paused IS 'Whether game is paused due to all players disconnecting';
COMMENT ON COLUMN games.paused_at IS 'Timestamp when game was paused';
COMMENT ON COLUMN games.notes IS 'Additional notes about game state (e.g., house win reason)';
