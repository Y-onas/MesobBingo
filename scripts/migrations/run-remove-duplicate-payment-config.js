const { pool, closePool } = require('../../src/database');
const logger = require('../../src/utils/logger');
require('dotenv').config();

async function runMigration() {
  let client;

  try {
    client = await pool.connect();
    
    logger.info('Starting duplicate payment config removal migration...');

    // Remove duplicate entries from system_config
    const result = await client.query(`
      DELETE FROM system_config 
      WHERE config_key IN ('telebirr_number', 'cbe_account')
      RETURNING config_key;
    `);

    if (result.rows.length > 0) {
      logger.info(`✅ Removed ${result.rows.length} duplicate config entries:`);
      result.rows.forEach(row => {
        logger.info(`   - ${row.config_key}`);
      });
    } else {
      logger.info('✅ No duplicate entries found (already cleaned up)');
    }

    logger.info('');
    logger.info('📝 Payment account numbers are now managed exclusively via payment_accounts table');
    logger.info('   Use configService.getActiveAccount(provider) to retrieve account details');

  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Run migration and close pool gracefully
// NOTE: closePool() is required to shut down the shared connection pool
// Without it, the event loop would hang and rely on process.exit() to terminate
runMigration()
  .then(async () => {
    await closePool();
    process.exit(0);
  })
  .catch(async () => {
    await closePool();
    process.exit(1);
  });
