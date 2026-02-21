const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { calledNumbers, games } = require('../../src/database/schema');
const { eq } = require('drizzle-orm');
require('dotenv').config();

async function testNeonHttp() {
  console.log('🔍 Testing Neon HTTP driver (used by bingo-engine)...\n');

  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql, { schema: { calledNumbers, games } });

  try {
    // Get an active game
    const activeGames = await sql`SELECT id FROM games WHERE status = 'playing' LIMIT 1`;
    if (activeGames.length === 0) {
      console.log('❌ No active games found to test with');
      process.exit(1);
    }

    const testGameId = activeGames[0].id;
    console.log(`Testing with game ID: ${testGameId}\n`);

    // Test rapid inserts like the game does
    console.log('Simulating rapid number calls (like the game)...');
    let inserted = false;
    let exitCode = 0;
    
    try {
      for (let i = 0; i < 10; i++) {
        try {
          const startTime = Date.now();
          
          // Insert called number (exactly like bingo-engine does)
          await db.insert(calledNumbers).values({
            gameId: testGameId,
            number: Math.floor(Math.random() * 75) + 1,
            callOrder: 9000 + i,
          });

          inserted = true;

          // Update game total calls (exactly like bingo-engine does)
          await db.update(games)
            .set({ totalCalls: 9000 + i })
            .where(eq(games.id, testGameId));

          const duration = Date.now() - startTime;
          console.log(`   ✅ Call ${i + 1}: ${duration}ms`);
        } catch (err) {
          console.error(`   ❌ Call ${i + 1} failed:`, err.message);
          console.error('      Error name:', err.name);
          console.error('      Error cause:', err.cause);
          console.error('      Full error:', JSON.stringify(err, null, 2));
        }

        // Wait 2 seconds between calls (like the game)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log('✅ Test complete');
    } catch (error) {
      console.error('\n❌ Test failed:', error);
      exitCode = 1;
    } finally {
      if (inserted) {
        // Clean up test data
        console.log('\nCleaning up test data...');
        await sql`DELETE FROM called_numbers WHERE call_order >= 9000`;
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    exitCode = 1;
  }

  process.exit(exitCode);
}

testNeonHttp();
