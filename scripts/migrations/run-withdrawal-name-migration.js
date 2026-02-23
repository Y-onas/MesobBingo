/**
 * Add Account Holder Name to Withdrawals
 * 
 * This migration adds the account_holder_name field to the withdrawals table
 * for better security and verification of withdrawal requests.
 * 
 * Usage: node scripts/migrations/run-withdrawal-name-migration.js
 */

require('dotenv').config();
const { db } = require('../../src/database');
const { sql } = require('drizzle-orm');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  console.log('🔄 Running withdrawal account name migration...\n');

  try {
    // Execute ALTER TABLE statement
    console.log('📄 Adding account_holder_name column...');
    await db.execute(sql`
      ALTER TABLE withdrawals 
      ADD COLUMN IF NOT EXISTS account_holder_name TEXT
    `);
    console.log('✅ Column added successfully\n');

    // Execute COMMENT statement separately
    console.log('📝 Adding column comment...');
    await db.execute(sql`
      COMMENT ON COLUMN withdrawals.account_holder_name IS 'Full name of the account holder for withdrawal verification'
    `);
    console.log('✅ Comment added successfully\n');

    // Verify the column was added
    console.log('🔍 Verifying column was added...');
    const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'withdrawals'
      AND column_name = 'account_holder_name'
    `);

    if (result.rows && result.rows.length > 0) {
      console.log('✅ Column verified:');
      console.log(`   Name: ${result.rows[0].column_name}`);
      console.log(`   Type: ${result.rows[0].data_type}`);
      console.log(`   Nullable: ${result.rows[0].is_nullable}\n`);
    } else {
      console.log('⚠️  Column not found in verification\n');
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart your bot server');
    console.log('   2. Test withdrawal flow in Telegram');
    console.log('   3. Verify account holder name is collected');
    console.log('   4. Check admin dashboard shows the name\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

runMigration();
