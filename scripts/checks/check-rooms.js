require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function checkRooms() {
  try {
    const rooms = await sql`SELECT * FROM game_rooms ORDER BY id`;
    
    console.log('\n📋 Game Rooms Configuration:');
    rooms.forEach(room => {
      console.log(`\n  Room ${room.id}: ${room.name}`);
      console.log(`    Entry Fee: ${room.entry_fee} ETB`);
      console.log(`    Min Players: ${room.min_players}`);
      console.log(`    Max Players: ${room.max_players}`);
      console.log(`    Countdown: ${room.countdown_time}s`);
      console.log(`    Status: ${room.status}`);
    });

    console.log('\n✅ Room check complete!\n');
  } catch (error) {
    console.error('❌ Error checking rooms:', error);
    process.exit(1);
  }
}

checkRooms();
