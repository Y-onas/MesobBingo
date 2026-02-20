const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Running game tables migration...');
    
    // Create games table
    console.log('Creating games table...');
    await sql`
      CREATE TABLE IF NOT EXISTS games (
        id serial PRIMARY KEY NOT NULL,
        room_id integer NOT NULL,
        status varchar(20) DEFAULT 'waiting' NOT NULL,
        win_pattern varchar(20) DEFAULT 'any' NOT NULL,
        winner_id bigint,
        winner_board_number integer,
        prize_pool numeric(12, 2) DEFAULT '0' NOT NULL,
        commission numeric(12, 2) DEFAULT '0' NOT NULL,
        player_count integer DEFAULT 0 NOT NULL,
        total_calls integer DEFAULT 0 NOT NULL,
        started_at timestamp,
        finished_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Create boards table
    console.log('Creating boards table...');
    await sql`
      CREATE TABLE IF NOT EXISTS boards (
        id serial PRIMARY KEY NOT NULL,
        game_id integer NOT NULL,
        board_number integer NOT NULL,
        content text NOT NULL,
        board_hash text NOT NULL,
        assigned_to bigint,
        assigned_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Create game_players table
    console.log('Creating game_players table...');
    await sql`
      CREATE TABLE IF NOT EXISTS game_players (
        id serial PRIMARY KEY NOT NULL,
        game_id integer NOT NULL,
        telegram_id bigint NOT NULL,
        board_number integer NOT NULL,
        bet_amount numeric(12, 2) NOT NULL,
        joined_at timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Create called_numbers table
    console.log('Creating called_numbers table...');
    await sql`
      CREATE TABLE IF NOT EXISTS called_numbers (
        id serial PRIMARY KEY NOT NULL,
        game_id integer NOT NULL,
        number integer NOT NULL,
        call_order integer NOT NULL,
        called_at timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Create indexes
    console.log('Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS games_room_id_idx ON games (room_id)`;
    await sql`CREATE INDEX IF NOT EXISTS games_status_idx ON games (status)`;
    await sql`CREATE INDEX IF NOT EXISTS boards_game_id_idx ON boards (game_id)`;
    await sql`CREATE INDEX IF NOT EXISTS boards_assigned_to_idx ON boards (assigned_to)`;
    await sql`CREATE INDEX IF NOT EXISTS game_players_game_id_idx ON game_players (game_id)`;
    await sql`CREATE INDEX IF NOT EXISTS game_players_telegram_id_idx ON game_players (telegram_id)`;
    await sql`CREATE INDEX IF NOT EXISTS called_numbers_game_id_idx ON called_numbers (game_id)`;
    
    console.log('✅ Game tables migration successful!');
    console.log('\nCreated tables:');
    console.log('  - games');
    console.log('  - boards');
    console.log('  - game_players');
    console.log('  - called_numbers');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

runMigration();
