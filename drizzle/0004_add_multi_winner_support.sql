-- Migration: Add multi-winner support and false claim tracking
-- Created: 2026-02-19

-- Update games table to support multiple winners
ALTER TABLE games ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT '[]';
ALTER TABLE games ADD COLUMN IF NOT EXISTS winner_count INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS prize_per_winner NUMERIC(10,2) DEFAULT 0;

-- Update game_rooms table to add winner time window configuration
ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS winner_time_window_ms INTEGER DEFAULT 1000;

-- Update game_players table to track false claims
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS false_claim_count INTEGER DEFAULT 0;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS removed_for_false_claims BOOLEAN DEFAULT FALSE;

-- Create index for faster winner queries
CREATE INDEX IF NOT EXISTS idx_games_winners ON games USING GIN (winners);
CREATE INDEX IF NOT EXISTS idx_game_players_false_claims ON game_players (game_id, false_claim_count) WHERE false_claim_count > 0;
