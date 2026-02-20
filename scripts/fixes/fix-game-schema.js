require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function fixGameSchema() {
  // SAFETY CHECK: Prevent accidental execution in production
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.CONFIRM_GAME_SCHEMA_RESET !== 'true'
  ) {
    console.error('❌ SAFETY CHECK FAILED');
    console.error('');
    console.error('⚠️  This script will DROP all game tables and data!');
    console.error('⚠️  Refusing to run in production without explicit confirmation.');
    console.error('');
    console.error('To proceed in production, set:');
    console.error('  CONFIRM_GAME_SCHEMA_RESET=true');
    console.error('');
    console.error('⚠️  WARNING: This will permanently delete all game data!');
    process.exit(1);
  }

  // Additional warning for all environments
  console.log('⚠️  WARNING: This script will DROP and recreate game tables!');
  console.log('⚠️  All game data will be permanently lost!');
  console.log('');
  
  if (process.env.NODE_ENV === 'production') {
    console.log('🔴 Running in PRODUCTION mode');
    console.log(`   Confirmation: ${process.env.CONFIRM_GAME_SCHEMA_RESET}`);
    console.log('');
  }

  try {
    console.log('🔄 Dropping old game tables...');
    
    // Drop tables in correct order (respecting foreign keys)
    await sql`DROP TABLE IF EXISTS called_numbers CASCADE`;
    await sql`DROP TABLE IF EXISTS game_players CASCADE`;
    await sql`DROP TABLE IF EXISTS boards CASCADE`;
    await sql`DROP TABLE IF EXISTS games CASCADE`;
    
    console.log('✅ Old tables dropped');
    
    console.log('🔄 Creating new game tables with correct schema...');
    
    // Create games table with correct schema
    await sql`
      CREATE TABLE games (
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
    await sql`
      CREATE TABLE boards (
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
    await sql`
      CREATE TABLE game_players (
        id serial PRIMARY KEY NOT NULL,
        game_id integer NOT NULL,
        telegram_id bigint NOT NULL,
        board_number integer NOT NULL,
        bet_amount numeric(12, 2) NOT NULL,
        joined_at timestamp DEFAULT now() NOT NULL
      )
    `;
    
    // Create called_numbers table
    await sql`
      CREATE TABLE called_numbers (
        id serial PRIMARY KEY NOT NULL,
        game_id integer NOT NULL,
        number integer NOT NULL,
        call_order integer NOT NULL,
        called_at timestamp DEFAULT now() NOT NULL
      )
    `;
    
    console.log('✅ Tables created');
    
    console.log('🔄 Creating indexes...');
    
    // Create indexes
    await sql`CREATE INDEX games_room_id_idx ON games (room_id)`;
    await sql`CREATE INDEX games_status_idx ON games (status)`;
    await sql`CREATE INDEX boards_game_id_idx ON boards (game_id)`;
    await sql`CREATE INDEX boards_assigned_to_idx ON boards (assigned_to)`;
    await sql`CREATE INDEX game_players_game_id_idx ON game_players (game_id)`;
    await sql`CREATE INDEX game_players_telegram_id_idx ON game_players (telegram_id)`;
    await sql`CREATE INDEX called_numbers_game_id_idx ON called_numbers (game_id)`;
    
    console.log('✅ Indexes created');
    
    console.log('\n✅ Game schema fixed successfully!\n');
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  }
}

fixGameSchema();
