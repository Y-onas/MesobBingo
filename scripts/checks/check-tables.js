const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function checkTables() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('games', 'boards', 'game_players', 'called_numbers')
    `;
    
    console.log('Game tables in database:');
    tables.forEach(t => console.log(`  ✅ ${t.table_name}`));
    
    if (tables.length === 4) {
      console.log('\n✅ All game tables exist!');
    } else {
      console.log(`\n⚠️  Only ${tables.length}/4 tables exist`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
}

checkTables();
