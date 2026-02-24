#!/usr/bin/env node

/**
 * Run Dynamic Config Constraints Migration
 * 
 * Adds CHECK constraints to dynamic_config table to enforce:
 * - value_type must be one of: 'string', 'number', 'boolean', 'json'
 * - category must be one of: 'payment', 'limits', 'bonuses', 'game', 'features'
 */

const { pool, closePool } = require('../../src/database');
const logger = require('../../src/utils/logger');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let client;
  
  try {
    logger.info('Starting dynamic config constraints migration...');
    
    client = await pool.connect();
    
    // Read migration SQL
    const migrationPath = path.join(__dirname, '../../drizzle/0011_add_dynamic_config_constraints.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration in explicit transaction
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    logger.info('✅ CHECK constraints added successfully');
    logger.info('   - dynamic_config.value_type: string, number, boolean, json');
    logger.info('   - dynamic_config.category: payment, limits, bonuses, game, features');
    logger.info('   - payment_accounts.provider: telebirr, cbe');
    logger.info('✅ Auto-update triggers created successfully');
    logger.info('   - system_config.updated_at');
    logger.info('   - referral_tiers.updated_at');
    logger.info('   - payment_accounts.updated_at');
    
  } catch (error) {
    // Rollback transaction on error
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Ignore rollback errors (transaction may not have started)
      }
    }
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
