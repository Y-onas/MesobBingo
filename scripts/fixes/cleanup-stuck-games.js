const { pool } = require('../../src/database/index');
require('dotenv').config();

async function cleanupStuckGames() {
  console.log('🧹 Cleaning up stuck games...\n');

  let client;
  try {
    client = await pool.connect();
    
    // Find games that have been "playing" for more than 2 hours
    const stuckGames = await client.query(`
      SELECT id, status, total_calls, created_at, 
             EXTRACT(EPOCH FROM (NOW() - created_at))/3600 as hours_old
      FROM games 
      WHERE status = 'playing' 
        AND created_at < NOW() - INTERVAL '2 hours'
      ORDER BY created_at ASC
    `);

    if (stuckGames.rows.length === 0) {
      console.log('✅ No stuck games found');
      return;
    }

    console.log(`Found ${stuckGames.rows.length} stuck games:\n`);
    stuckGames.rows.forEach(g => {
      console.log(`  Game ${g.id}: ${g.total_calls} calls, ${Math.floor(g.hours_old)} hours old`);
    });

    console.log('\nMarking as completed (no winner)...');
    
    const result = await client.query(`
      UPDATE games 
      SET status = 'completed',
          finished_at = NOW()
      WHERE status = 'playing' 
        AND created_at < NOW() - INTERVAL '2 hours'
      RETURNING id
    `);

    console.log(`✅ Cleaned up ${result.rows.length} games`);
    result.rows.forEach(g => console.log(`   - Game ${g.id}`));

  } catch (error) {
    console.error('❌ Error:', error);
    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

cleanupStuckGames().catch(err => {
  console.error('❌ Unhandled error:', err);
  process.exit(1);
});
