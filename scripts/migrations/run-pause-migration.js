/**
 * Migration Script: Add pause fields to games table
 * Run this before deploying the code quality fixes
 */

const { pool } = require('../../src/database');
const logger = require('../../src/utils/logger');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting pause fields migration...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../../drizzle/0006_add_pause_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Check if columns already exist
    const checkQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'games' 
      AND column_name IN ('paused', 'paused_at', 'notes')
    `;
    
    const { rows } = await client.query(checkQuery);
    
    if (rows.length > 0) {
      logger.info('Pause fields already exist. Skipping migration.');
      logger.info(`Existing columns: ${rows.map(r => r.column_name).join(', ')}`);
      return;
    }
    
    // Run the migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');
    
    logger.info('✅ Migration completed successfully!');
    logger.info('Added columns: paused, paused_at, notes');
    logger.info('Added index: idx_games_paused');
    
    // Verify the migration
    const verifyQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'games' 
      AND column_name IN ('paused', 'paused_at', 'notes')
      ORDER BY column_name
    `;
    
    const { rows: verifyRows } = await client.query(verifyQuery);
    
    logger.info('Verification:');
    verifyRows.forEach(row => {
      logger.info(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable}, default: ${row.column_default})`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration()
  .then(() => {
    logger.info('Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Migration script failed:', error);
    process.exit(1);
  });
