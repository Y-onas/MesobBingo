#!/usr/bin/env node

/**
 * Run Referral Tier Constraints Migration
 * 
 * Adds CHECK constraints to referral_tiers table to enforce:
 * - max_deposit > min_deposit (when not NULL)
 * - bonus_amount > 0
 * - min_deposit >= 0
 */

const { pool, closePool } = require('../../src/database');
const logger = require('../../src/utils/logger');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let client;
  
  try {
    logger.info('Starting referral tier constraints migration...');
    
    client = await pool.connect();
    
    // Read migration SQL
    const migrationPath = path.join(__dirname, '../../drizzle/0012_add_referral_tier_constraints.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute migration in explicit transaction
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    logger.info('✅ Referral tier constraints added successfully');
    logger.info('   - max_deposit > min_deposit (when not NULL)');
    logger.info('   - bonus_amount > 0');
    logger.info('   - min_deposit >= 0');
    
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
