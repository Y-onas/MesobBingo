const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { Pool } = require('pg');
const { DATABASE_URL } = require('../config/env');
const logger = require('../utils/logger');
const schema = require('./schema');

if (!DATABASE_URL) {
  logger.error('DATABASE_URL is not set in environment variables');
  process.exit(1);
}

// ─── Neon HTTP driver (for simple queries via Drizzle) ──────────────
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

// ─── pg Pool (for transactions with SELECT ... FOR UPDATE) ──────────
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  logger.error('Database pool error:', err);
});

// Health check
const checkDbHealth = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (err) {
    logger.error('DB health check failed:', err);
    return false;
  }
};

logger.info('Neon database connection configured (HTTP + Pool)');

module.exports = { db, pool, checkDbHealth };
