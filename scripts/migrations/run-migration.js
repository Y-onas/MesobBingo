const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function runMigration() {
  try {
    console.log('Adding sms_text column to deposits table...');
    await sql`ALTER TABLE deposits ADD COLUMN IF NOT EXISTS sms_text text`;
    console.log('✅ Migration successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
