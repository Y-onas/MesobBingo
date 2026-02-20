-- Add use_dynamic_percentage column to game_rooms
ALTER TABLE game_rooms 
ADD COLUMN use_dynamic_percentage BOOLEAN DEFAULT FALSE NOT NULL;

-- Create win_percentage_rules table
CREATE TABLE win_percentage_rules (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  min_players INTEGER NOT NULL CHECK (min_players >= 1),
  max_players INTEGER NOT NULL CHECK (max_players >= min_players),
  win_percentage INTEGER NOT NULL CHECK (win_percentage >= 1 AND win_percentage <= 100),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(room_id, min_players, max_players)
);

-- Create indexes for performance
CREATE INDEX idx_win_rules_room ON win_percentage_rules(room_id);
CREATE INDEX idx_win_rules_range ON win_percentage_rules(room_id, min_players, max_players);

-- Add comment
COMMENT ON TABLE win_percentage_rules IS 'Configurable win percentage rules based on player count ranges';
COMMENT ON COLUMN game_rooms.use_dynamic_percentage IS 'Enable dynamic win percentage calculation based on player count';
