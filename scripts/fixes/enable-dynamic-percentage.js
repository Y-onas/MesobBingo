require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function enableDynamicPercentage() {
  const roomId = process.argv[2];
  
  if (!roomId) {
    console.error('Usage: node enable-dynamic-percentage.js <roomId>');
    console.error('Example: node enable-dynamic-percentage.js 1');
    process.exit(1);
  }
  
  try {
    console.log(`Enabling dynamic percentage for room ${roomId}...\n`);
    
    // Check if room exists
    const [room] = await sql`
      SELECT id, name, use_dynamic_percentage 
      FROM game_rooms 
      WHERE id = ${parseInt(roomId)}
    `;
    
    if (!room) {
      console.error(`❌ Room ${roomId} not found`);
      process.exit(1);
    }
    
    console.log(`Room: ${room.name}`);
    console.log(`Current: ${room.use_dynamic_percentage ? 'Enabled' : 'Disabled'}`);
    
    if (room.use_dynamic_percentage) {
      console.log('\n✅ Dynamic percentage is already enabled');
      process.exit(0);
    }
    
    // Enable dynamic percentage
    await sql`
      UPDATE game_rooms 
      SET use_dynamic_percentage = true 
      WHERE id = ${parseInt(roomId)}
    `;
    
    console.log('\n✅ Dynamic percentage enabled!');
    console.log('\n💡 Make sure you have win percentage rules defined for this room.');
    console.log('   Run: node scripts/checks/check-dynamic-percentage.js');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

enableDynamicPercentage();
