require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function checkDynamicPercentage() {
  try {
    console.log('Checking dynamic percentage settings...\n');
    
    const rooms = await sql`
      SELECT 
        id, 
        name, 
        winning_percentage,
        use_dynamic_percentage,
        max_players
      FROM game_rooms 
      ORDER BY id
    `;
    
    console.log('📋 Game Rooms:\n');
    rooms.forEach(room => {
      console.log(`Room ${room.id}: ${room.name}`);
      console.log(`  Static Win %: ${room.winning_percentage}%`);
      console.log(`  Dynamic Enabled: ${room.use_dynamic_percentage ? '✅ YES' : '❌ NO'}`);
      console.log(`  Max Players: ${room.max_players}`);
      console.log('');
    });
    
    // Check rules
    const rules = await sql`
      SELECT 
        wr.*,
        gr.name as room_name
      FROM win_percentage_rules wr
      LEFT JOIN game_rooms gr ON wr.room_id = gr.id
      ORDER BY wr.room_id, wr.min_players
    `;
    
    if (rules.length > 0) {
      console.log('📝 Win Percentage Rules:\n');
      rules.forEach(rule => {
        console.log(`Room ${rule.room_id} (${rule.room_name}):`);
        console.log(`  ${rule.min_players}-${rule.max_players} players → ${rule.win_percentage}%`);
      });
    } else {
      console.log('⚠️  No win percentage rules defined\n');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDynamicPercentage();
