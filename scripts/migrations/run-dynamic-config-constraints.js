#!/usr/bin/env node

/**
 * Run Dynamic Config Constraints Migration
 * 
 * Adds CHECK constraints to dynamic_config table to enforce:
 * - value_type must be one of: 'string', 'number', 'boolean', 'json'
 * - category must be one of: 'payment', 'limits', 'bonuses', 'game', 'features'
 */

const { pool } = require('../../src/database');
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
    
    // Execute migration
    await client.query(migrationSQL);
    
    logger.info('✅ CHECK constraints added successfully');
    logger.info('   - dynamic_config.value_type: string, number, boolean, json');
    logger.info('   - dynamic_config.category: payment, limits, bonuses, game, features');
    logger.info('   - payment_accounts.provider: telebirr, cbe');
    logger.info('✅ Auto-update triggers created successfully');
    logger.info('   - system_config.updated_at');
    logger.info('   - referral_tiers.updated_at');
    logger.info('   - payment_accounts.updated_at');
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
