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

// Extract direct connection URL (remove -pooler for better performance)
// Parse URL properly to avoid corrupting passwords/database names containing '-pooler'
const directDatabaseUrl = (() => {
  try {
    const url = new URL(DATABASE_URL);
    // Only replace -pooler in hostname to avoid corrupting other URL parts
    url.hostname = url.hostname.replace('-pooler.', '.');
    return url.toString();
  } catch (error) {
    // Fallback to simple replace if URL parsing fails
    logger.warn('Could not parse DATABASE_URL, using simple string replacement');
    return DATABASE_URL.replace('-pooler.', '.');
  }
})();
const useDirectConnection = !DATABASE_URL.includes('-pooler');

if (!useDirectConnection) {
  logger.warn('⚠️  Using pooler connection. For better performance, use direct connection URL.');
  logger.warn('   Change: ep-xxx-pooler.region.aws.neon.tech → ep-xxx.region.aws.neon.tech');
}

// ─── Neon HTTP driver (for simple queries via Drizzle) ──────────────
// NOTE: We rely on PostgreSQL-level timeouts (statement_timeout, query_timeout)
// rather than HTTP-level AbortSignal because:
// 1. AbortSignal.timeout() creates a signal that aborts once and stays aborted forever
// 2. Reusing the same aborted signal causes all subsequent queries to fail immediately
// 3. PostgreSQL timeouts are more reliable and don't require per-query signal management
const sql = neon(DATABASE_URL, {
  fetchConnectionCache: true,
});
const db = drizzle(sql, { schema });

// ─── pg Pool (for transactions and critical operations) ──────────────
// Use direct connection for pool to avoid pooler timeout issues
const poolConfig = {
  connectionString: useDirectConnection ? DATABASE_URL : directDatabaseUrl,
  max: 10, // Reduced from 20 to avoid connection limits
  min: 2, // Keep minimum connections alive
  idleTimeoutMillis: 60000, // 60s idle timeout
  connectionTimeoutMillis: 15000, // 15s connection timeout
  statement_timeout: 15000, // 15s query timeout
  query_timeout: 15000, // Additional query timeout
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: { 
    // SECURITY NOTE: rejectUnauthorized: false disables SSL certificate validation
    // This is required for Neon's connection pooler which may use self-signed certificates
    // SECURITY TRADE-OFF: This bypasses Man-in-the-Middle (MITM) attack protection
    // The connection is still encrypted, but the server's identity is not verified
    // This is acceptable for Neon's managed infrastructure but understand the risk
    // For production with direct connection to trusted endpoints, consider setting to true
    rejectUnauthorized: false
  },
};

const pool = new Pool(poolConfig);

// Connection pool event handlers
pool.on('error', (err, client) => {
  logger.error('Unexpected database pool error:', {
    message: err.message,
    code: err.code,
    stack: err.stack
  });
});

pool.on('connect', (client) => {
  logger.debug('New database client connected to pool');
});

pool.on('remove', (client) => {
  logger.debug('Database client removed from pool');
});

// Enhanced health check with retry
const checkDbHealth = async (retries = 3) => {
  let client;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      client = await pool.connect();
      const result = await client.query('SELECT NOW() as time, version() as version');
      logger.info('Database health check passed:', {
        time: result.rows[0].time,
        poolSize: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingClients: pool.waitingCount
      });
      return true;
    } catch (err) {
      logger.error(`DB health check failed (attempt ${attempt}/${retries}):`, {
        message: err.message,
        code: err.code
      });
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
      }
    } finally {
      if (client) client.release();
    }
  }
  return false;
};

// Graceful shutdown handler
// NOTE: This is called by the main application's shutdown orchestrator (src/index.js)
// Do NOT register signal handlers here - they are handled centrally to ensure proper shutdown order
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Database pool closed gracefully');
  } catch (err) {
    logger.error('Error closing database pool:', err);
  }
};

logger.info('Neon database connection configured', {
  driver: 'HTTP + Pool',
  poolMax: poolConfig.max,
  poolMin: poolConfig.min,
  connectionType: useDirectConnection ? 'direct' : 'pooler (fallback to direct for pool)'
});

module.exports = { db, pool, checkDbHealth, closePool };
