/**
 * Add NOT NULL constraints to columns with defaults
 * 
 * This migration adds NOT NULL constraints to columns that have default values
 * in the system_config, referral_tiers, and payment_accounts tables.
 * This provides stronger schema guarantees and prevents accidental NULL values.
 */

const { pool } = require('../../src/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔧 Adding NOT NULL constraints to columns with defaults...\n');

  let client;
  let exitCode = 0;

  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Read and execute the migration SQL
    const migrationPath = path.join(__dirname, '../../drizzle/0010_add_not_null_constraints.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    await client.query(migrationSQL);

    await client.query('COMMIT');

    console.log('✅ NOT NULL constraints added successfully!');
    console.log('\n📝 Updated tables:');
    console.log('   - system_config (updated_at, created_at)');
    console.log('   - system_config_history (changed_at)');
    console.log('   - referral_tiers (is_active, created_at, updated_at)');
    console.log('   - payment_accounts (is_active, priority, current_daily_total, last_reset_date, created_at, updated_at)');

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Error adding NOT NULL constraints:', error);
    exitCode = 1;
  } finally {
    if (client) client.release();
    await pool.end();
    process.exitCode = exitCode;
  }
}

runMigration();
