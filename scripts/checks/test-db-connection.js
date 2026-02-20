const { Pool } = require('pg');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

async function testConnection() {
  console.log('Testing Neon database connection...\n');

  // Test 1: Neon HTTP
  console.log('1. Testing Neon HTTP driver...');
  try {
    const sql = neon(DATABASE_URL);
    const result = await sql`SELECT NOW() as time, version() as version`;
    console.log('✅ Neon HTTP: Connected');
    console.log('   Server time:', result[0].time);
    console.log('   Version:', result[0].version.substring(0, 50) + '...');
  } catch (error) {
    console.error('❌ Neon HTTP failed:', error.message);
    console.error('   Error details:', error);
  }

  console.log('\n2. Testing pg Pool...');
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time, current_database() as db');
    console.log('✅ pg Pool: Connected');
    console.log('   Server time:', result.rows[0].time);
    console.log('   Database:', result.rows[0].db);
    client.release();
  } catch (error) {
    console.error('❌ pg Pool failed:', error.message);
    console.error('   Error code:', error.code);
  } finally {
    await pool.end();
  }

  console.log('\n3. Testing table access...');
  try {
    const sql = neon(DATABASE_URL);
    const rooms = await sql`SELECT COUNT(*) as count FROM game_rooms`;
    console.log('✅ Table access: OK');
    console.log('   Game rooms count:', rooms[0].count);
    
    const users = await sql`SELECT COUNT(*) as count FROM users`;
    console.log('   Users count:', users[0].count);
  } catch (error) {
    console.error('❌ Table access failed:', error.message);
  }

  console.log('\nConnection test complete.');
  process.exit(0);
}

testConnection().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
