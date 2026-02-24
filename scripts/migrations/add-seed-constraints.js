/**
 * Add unique constraints to seed tables to prevent duplicates
 * 
 * The 0007 migration seeds referral_tiers and payment_accounts without
 * unique constraints, making re-runs create duplicates. This script adds
 * constraints to make future operations idempotent.
 */

const { pool } = require('../../src/database');

async function addSeedConstraints() {
  console.log('🔧 Adding unique constraints to seed tables...\n');

  const client = await pool.connect();
  let exitCode = 0;

  try {
    await client.query('BEGIN');

    // Check if referral_tiers constraint already exists
    const { rows: tierConstraint } = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public'
      AND table_name = 'referral_tiers' 
      AND constraint_name = 'uq_referral_tier_range'
    `);

    if (tierConstraint.length === 0) {
      console.log('1️⃣ Adding unique constraint to referral_tiers...');
      await client.query(`
        ALTER TABLE referral_tiers 
        ADD CONSTRAINT uq_referral_tier_range 
        UNIQUE (min_deposit, max_deposit)
      `);
      console.log('   ✅ Added uq_referral_tier_range constraint');
    } else {
      console.log('✅ referral_tiers constraint already exists');
    }

    // Check if payment_accounts constraint already exists
    const { rows: accountConstraint } = await client.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public'
      AND table_name = 'payment_accounts' 
      AND constraint_name = 'uq_payment_account'
    `);

    if (accountConstraint.length === 0) {
      console.log('\n2️⃣ Adding unique constraint to payment_accounts...');
      await client.query(`
        ALTER TABLE payment_accounts 
        ADD CONSTRAINT uq_payment_account 
        UNIQUE (provider, account_number)
      `);
      console.log('   ✅ Added uq_payment_account constraint');
    } else {
      console.log('✅ payment_accounts constraint already exists');
    }

    await client.query('COMMIT');

    console.log('\n✅ Seed table constraints added successfully!');
    console.log('\n📝 Benefits:');
    console.log('   - Prevents duplicate referral tiers');
    console.log('   - Prevents duplicate payment accounts');
    console.log('   - Makes seed operations idempotent');

  } catch (error) {
    exitCode = 1;
    await client.query('ROLLBACK');
    console.error('❌ Error adding constraints:', error);
  } finally {
    client.release();
    process.exit(exitCode);
  }
}

addSeedConstraints();
