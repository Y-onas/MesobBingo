require('dotenv').config();
const { pool, db } = require('../../src/database/index');
const { calledNumbers } = require('../../src/database/schema');
const { gte, and, eq } = require('drizzle-orm');

async function diagnose() {
  console.log('🔍 Diagnosing database connection issues...\n');

  let client;
  let exitCode = 0;
  
  try {
    // Check active games
    console.log('1. Checking active games...');
    client = await pool.connect();
    const result = await client.query(
      "SELECT id, status, total_calls, created_at FROM games WHERE status = 'playing' ORDER BY created_at DESC LIMIT 5"
    );
    console.log(`   Found ${result.rows.length} active games`);
    result.rows.forEach(g => {
      console.log(`   - Game ${g.id}: ${g.total_calls} calls, started ${g.created_at}`);
    });

    // Check pool status
    console.log('\n2. Connection pool status:');
    console.log(`   Total connections: ${pool.totalCount}`);
    console.log(`   Idle connections: ${pool.idleCount}`);
    console.log(`   Waiting requests: ${pool.waitingCount}`);

    // Test rapid inserts (simulate game calling)
    console.log('\n3. Testing rapid database writes...');
    const testGameId = result.rows[0]?.id;
    
    if (!testGameId) {
      console.log('   ⚠️  No active game found; skipping write test.');
    } else {
      for (let i = 0; i < 5; i++) {
        try {
          await db.insert(calledNumbers).values({
            gameId: testGameId,
            number: Math.floor(Math.random() * 75) + 1,
            callOrder: 999 + i,
          });
          console.log(`   ✅ Insert ${i + 1} succeeded`);
        } catch (err) {
          console.error(`   ❌ Insert ${i + 1} failed:`, err.message);
          console.error('      Error details:', JSON.stringify(err, null, 2));
        }
        // Small delay between writes
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Clean up test data using ORM (scoped to testGameId)
      await db.delete(calledNumbers).where(
        and(
          eq(calledNumbers.gameId, testGameId),
          gte(calledNumbers.callOrder, 999)
        )
      );
      console.log('   Test data cleaned up');
    }

    console.log('\n✅ Diagnosis complete');
  } catch (error) {
    console.error('\n❌ Diagnosis failed:', error);
    exitCode = 1;
  } finally {
    // Release client in finally block to ensure it's always released
    if (client) {
      client.release();
    }
    await pool.end();
    process.exit(exitCode);
  }
}

diagnose();
