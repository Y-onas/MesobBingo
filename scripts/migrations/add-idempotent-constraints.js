require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function addIdempotentConstraints() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking existing constraints...');
    
    // Check if constraints already exist
    const { rows: existingConstraints } = await client.query(`
      SELECT constraint_name, table_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND table_name IN ('referral_tiers', 'payment_accounts')
        AND constraint_type = 'UNIQUE'
    `);
    
    console.log('Existing constraints:', existingConstraints);
    
    const hasReferralConstraint = existingConstraints.some(c => 
      c.table_name === 'referral_tiers' && c.constraint_name === 'uq_referral_tiers_range'
    );
    
    const hasPaymentConstraint = existingConstraints.some(c => 
      c.table_name === 'payment_accounts' && c.constraint_name === 'uq_payment_accounts_provider_number'
    );
    
    // Add referral_tiers constraint if missing
    if (!hasReferralConstraint) {
      console.log('➕ Adding unique constraint to referral_tiers...');
      await client.query(`
        ALTER TABLE referral_tiers 
        ADD CONSTRAINT uq_referral_tiers_range 
        UNIQUE (min_deposit, max_deposit)
      `);
      console.log('✅ Referral tiers constraint added');
    } else {
      console.log('✓ Referral tiers constraint already exists');
    }
    
    // Add payment_accounts constraint if missing
    if (!hasPaymentConstraint) {
      console.log('➕ Adding unique constraint to payment_accounts...');
      await client.query(`
        ALTER TABLE payment_accounts 
        ADD CONSTRAINT uq_payment_accounts_provider_number 
        UNIQUE (provider, account_number)
      `);
      console.log('✅ Payment accounts constraint added');
    } else {
      console.log('✓ Payment accounts constraint already exists');
    }
    
    console.log('\n✅ Migration complete - constraints are now idempotent');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addIdempotentConstraints()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
