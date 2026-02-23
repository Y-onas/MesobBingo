#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('../../src/database');
const logger = require('../../src/utils/logger');

/**
 * Run migration to add withdrawable_balance and playing_balance
 */
async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting withdrawable balance migration...\n');
    
    await client.query('BEGIN');
    
    // Check if columns already exist
    const { rows: columns } = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('withdrawable_balance', 'playing_balance', 'total_winnings')
    `);
    
    const existingColumns = columns.map(c => c.column_name);
    
    if (existingColumns.includes('withdrawable_balance')) {
      console.log('⚠️  Columns already exist. Skipping migration.');
      await client.query('ROLLBACK');
      return;
    }
    
    console.log('1️⃣ Adding new balance columns...');
    await client.query(`
      ALTER TABLE users ADD COLUMN withdrawable_balance NUMERIC(12,2) DEFAULT 0 NOT NULL;
      ALTER TABLE users ADD COLUMN playing_balance NUMERIC(12,2) DEFAULT 0 NOT NULL;
      ALTER TABLE users ADD COLUMN total_winnings NUMERIC(12,2) DEFAULT 0 NOT NULL;
    `);
    console.log('✅ Columns added\n');
    
    console.log('2️⃣ Migrating existing balances...');
    await client.query(`
      UPDATE users SET 
        withdrawable_balance = main_wallet,
        playing_balance = play_wallet
    `);
    
    const { rows: [result] } = await client.query(`
      SELECT COUNT(*) as count FROM users
    `);
    console.log(`✅ Migrated ${result.count} user balances\n`);
    
    await client.query('COMMIT');
    
    console.log('✅ Migration completed successfully!\n');
    console.log('📊 Summary:');
    console.log('   - Added withdrawable_balance column');
    console.log('   - Added playing_balance column');
    console.log('   - Added total_winnings column');
    console.log('   - Migrated existing balances (main_wallet → withdrawable, play_wallet → playing)');
    console.log('   - Old columns kept for backward compatibility\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error);
