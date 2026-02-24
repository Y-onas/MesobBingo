/**
 * Backfill total_winnings for existing users
 * 
 * The 0009 migration left total_winnings = 0 for all existing users,
 * but main_wallet contains historical winnings. This script backfills
 * total_winnings from main_wallet to fix the discrepancy.
 */

const { pool } = require('../../src/database');

async function backfillTotalWinnings() {
  console.log('🔧 Backfilling total_winnings for existing users...\n');

  let client;
  let exitCode = 0;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Check how many users need backfilling
    const { rows: needsBackfill } = await client.query(
      'SELECT COUNT(*) as count FROM users WHERE total_winnings = 0 AND main_wallet > 0'
    );

    if (needsBackfill[0].count === '0') {
      console.log('✅ No users need backfilling (all total_winnings already set)');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`📊 Found ${needsBackfill[0].count} users with total_winnings = 0 but main_wallet > 0`);

    // Backfill total_winnings from main_wallet
    const { rowCount } = await client.query(`
      UPDATE users 
      SET total_winnings = main_wallet 
      WHERE total_winnings = 0 AND main_wallet > 0
    `);

    await client.query('COMMIT');

    console.log(`✅ Successfully backfilled total_winnings for ${rowCount} users`);
    console.log('\n📝 Note: This assumes main_wallet represents historical winnings');
    console.log('   Future winnings will be tracked accurately via bingo-engine.js');

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Error backfilling total_winnings:', error);
    exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
    process.exitCode = exitCode;
  }
}

backfillTotalWinnings();
