const { db } = require('../../src/database');
const { gameRooms } = require('../../src/database/schema');
const { eq } = require('drizzle-orm');

/**
 * Update winner time window from 1000ms to 100ms for faster winner announcements
 */
async function updateWinnerWindow() {
  try {
    console.log('Updating winner time window for all game rooms...');

    // Update all rooms to use 100ms window
    const result = await db
      .update(gameRooms)
      .set({ winnerTimeWindowMs: 100 })
      .returning();

    console.log(`✅ Updated ${result.length} game room(s)`);
    console.log('Winner announcements will now be nearly instant (100ms delay)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating winner window:', error);
    process.exit(1);
  }
}

updateWinnerWindow();
