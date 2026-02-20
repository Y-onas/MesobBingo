require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function copyWinRules() {
  const fromRoomId = process.argv[2];
  const toRoomId = process.argv[3];
  
  if (!fromRoomId || !toRoomId) {
    console.error('Usage: node copy-win-rules.js <fromRoomId> <toRoomId>');
    console.error('Example: node copy-win-rules.js 2 1');
    process.exit(1);
  }
  
  try {
    console.log(`Copying win rules from Room ${fromRoomId} to Room ${toRoomId}...\n`);
    
    // Get rules from source room
    const rules = await sql`
      SELECT min_players, max_players, win_percentage
      FROM win_percentage_rules
      WHERE room_id = ${parseInt(fromRoomId)}
      ORDER BY min_players
    `;
    
    if (rules.length === 0) {
      console.error(`❌ No rules found in Room ${fromRoomId}`);
      process.exit(1);
    }
    
    console.log(`Found ${rules.length} rules in Room ${fromRoomId}:`);
    rules.forEach(r => {
      console.log(`  ${r.min_players}-${r.max_players} players → ${r.win_percentage}%`);
    });
    
    // Check if target room already has rules
    const existing = await sql`
      SELECT COUNT(*) as count
      FROM win_percentage_rules
      WHERE room_id = ${parseInt(toRoomId)}
    `;
    
    if (existing[0].count > 0) {
      console.log(`\n⚠️  Room ${toRoomId} already has ${existing[0].count} rule(s)`);
      console.log('Delete existing rules first or use a different room.');
      process.exit(1);
    }
    
    // Copy rules
    console.log(`\nCopying to Room ${toRoomId}...`);
    for (const rule of rules) {
      await sql`
        INSERT INTO win_percentage_rules (room_id, min_players, max_players, win_percentage)
        VALUES (
          ${parseInt(toRoomId)},
          ${rule.min_players},
          ${rule.max_players},
          ${rule.win_percentage}
        )
      `;
    }
    
    console.log(`\n✅ Successfully copied ${rules.length} rules to Room ${toRoomId}!`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

copyWinRules();
