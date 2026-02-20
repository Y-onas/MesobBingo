/**
 * Run validation enhancements migration
 * Adds multi-winner support and false claim tracking
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true 
  }
});

async function runMigration() {
  let exitCode = 0;
  console.log('🔄 Running validation enhancements migration...\n');

  const client = await pool.connect();
  try {
    // Read migration file
    const migrationPath = path.resolve(
      __dirname,
      '..',
      '..',
      'drizzle',
      '0004_add_multi_winner_support.sql'
    );
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');
    console.log('Added columns:');
    console.log('  - games.winners (JSONB)');
    console.log('  - games.winner_count (INTEGER)');
    console.log('  - games.prize_per_winner (NUMERIC)');
    console.log('  - game_rooms.winner_time_window_ms (INTEGER)');
    console.log('  - game_players.false_claim_count (INTEGER)');
    console.log('  - game_players.removed_for_false_claims (BOOLEAN)');
    console.log('\n✅ Indexes created for performance');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }

  process.exit(exitCode);
}

runMigration();
