require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running dynamic win percentage migration...');
    
    // Add use_dynamic_percentage column to game_rooms
    console.log('Adding use_dynamic_percentage column...');
    await sql`ALTER TABLE game_rooms ADD COLUMN IF NOT EXISTS use_dynamic_percentage BOOLEAN DEFAULT FALSE NOT NULL`;
    
    // Create win_percentage_rules table
    console.log('Creating win_percentage_rules table...');
    await sql`
      CREATE TABLE IF NOT EXISTS win_percentage_rules (
        id SERIAL PRIMARY KEY,
        room_id INTEGER NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
        min_players INTEGER NOT NULL CHECK (min_players >= 1),
        max_players INTEGER NOT NULL CHECK (max_players >= min_players),
        win_percentage INTEGER NOT NULL CHECK (win_percentage >= 1 AND win_percentage <= 100),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        UNIQUE(room_id, min_players, max_players)
      )
    `;
    
    // Create indexes
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_win_rules_room ON win_percentage_rules(room_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_win_rules_range ON win_percentage_rules(room_id, min_players, max_players)`;
    
    console.log('✅ Dynamic win percentage migration successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
