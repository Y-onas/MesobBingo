require('dotenv').config();
const { pool } = require('../../src/database/index');

async function cleanupStuckGames() {
  console.log('🧹 Cleaning up stuck games...\n');

  let client;
  try {
    client = await pool.connect();
    
    // Atomically find and update stuck games in one query to eliminate TOCTOU race condition
    // NOTE: Age calculation uses created_at and doesn't account for cumulative pause time.
    // A game paused for 90 minutes then resumed will be cleaned up if created_at > 2 hours ago,
    // even if actual active play time is less. Consider adding total_paused_seconds column.
    // NOTE: This uses UPDATE...RETURNING for atomicity. For additional safety against concurrent
    // runs, consider wrapping in BEGIN/COMMIT with SELECT...FOR UPDATE.
    const result = await client.query(`
      UPDATE games
      SET status = 'completed',
          finished_at = NOW()
      WHERE status = 'playing'
        AND created_at < NOW() - INTERVAL '2 hours'
        AND (paused IS NULL OR paused = false)
      RETURNING id, total_calls,
                EXTRACT(EPOCH FROM (NOW() - created_at))/3600 AS hours_old
    `);

    if (result.rows.length === 0) {
      console.log('✅ No stuck games found');
      return;
    }

    console.log(`✅ Cleaned up ${result.rows.length} stuck games:\n`);
    result.rows.forEach(g => {
      console.log(`  Game ${g.id}: ${g.total_calls} calls, ${Math.floor(g.hours_old)} hours old`);
    });

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
