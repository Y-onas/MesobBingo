const { Pool } = require('pg');
const logger = require('../../src/utils/logger');
require('dotenv').config();

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    
    logger.info('Starting referral tier constraints migration...');

    // Read and execute the migration SQL
    await client.query(`
      -- Add CHECK constraint to ensure max_deposit > min_deposit when max_deposit is not NULL
      ALTER TABLE referral_tiers
      ADD CONSTRAINT chk_max_greater_than_min 
      CHECK (max_deposit IS NULL OR max_deposit > min_deposit);

      -- Add CHECK constraint to ensure bonus_amount is positive
      ALTER TABLE referral_tiers
      ADD CONSTRAINT chk_bonus_positive 
      CHECK (bonus_amount > 0);

      -- Add CHECK constraint to ensure min_deposit is non-negative
      ALTER TABLE referral_tiers
      ADD CONSTRAINT chk_min_deposit_non_negative 
      CHECK (min_deposit >= 0);
    `);

    logger.info('✅ Referral tier constraints added successfully');
    logger.info('   - max_deposit > min_deposit (when not NULL)');
    logger.info('   - bonus_amount > 0');
    logger.info('   - min_deposit >= 0');

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
