/**
 * Check if win_percentage_rules table exists in database
 */
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function checkTable() {
  try {
    console.log('Checking win_percentage_rules table...\n');
    
    // Check if table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'win_percentage_rules'
      );
    `;
    
    const tableExists = tableCheck[0].exists;
    
    if (tableExists) {
      console.log('✅ Table win_percentage_rules EXISTS');
      
      // Get table structure
      const columns = await sql`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = 'win_percentage_rules'
        ORDER BY ordinal_position;
      `;
      
      console.log('\n📋 Table Structure:');
      columns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      });
      
      // Check indexes
      const indexes = await sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'win_percentage_rules';
      `;
      
      console.log('\n🔍 Indexes:');
      indexes.forEach(idx => {
        console.log(`   - ${idx.indexname}`);
      });
      
      // Check foreign keys
      const foreignKeys = await sql`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'win_percentage_rules'
          AND tc.constraint_type = 'FOREIGN KEY';
      `;
      
      console.log('\n🔗 Foreign Keys:');
      foreignKeys.forEach(fk => {
        console.log(`   - ${fk.column_name} -> ${fk.foreign_table_name}(${fk.foreign_column_name})`);
      });
      
      // Count rows
      const count = await sql`SELECT COUNT(*) as count FROM win_percentage_rules;`;
      console.log(`\n📊 Total Rules: ${count[0].count}`);
      
      if (count[0].count > 0) {
        const rules = await sql`
          SELECT wr.*, gr.name as room_name
          FROM win_percentage_rules wr
          LEFT JOIN game_rooms gr ON wr.room_id = gr.id
          ORDER BY wr.room_id, wr.min_players;
        `;
        
        console.log('\n📝 Existing Rules:');
        rules.forEach(rule => {
          console.log(`   Room: ${rule.room_name || rule.room_id} | Players: ${rule.min_players}-${rule.max_players} | Win%: ${rule.win_percentage}%`);
        });
      }
      
    } else {
      console.log('❌ Table win_percentage_rules DOES NOT EXIST');
      console.log('\n💡 Run migration to create it:');
      console.log('   node scripts/migrations/run-win-percentage-migration.js');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
  
  process.exit(0);
}

checkTable();
