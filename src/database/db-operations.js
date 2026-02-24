// IMPORTANT: This module imports from ./index but index.js does NOT import from here.
// If index.js ever imports from db-operations.js, it will create a circular dependency
// causing Node.js to deliver a partially-initialized module. Keep this one-way dependency.
const { db, pool } = require('./index');
const logger = require('../utils/logger');

/**
 * Global DB health state
 * When false, blocks all critical game operations to prevent corruption
 */
let dbHealthy = true;
let lastHealthCheck = Date.now();
let recoveryTimer = null;
const HEALTH_CHECK_INTERVAL = 5000; // Check every 5s

/**
 * Mark database as unhealthy and schedule recovery check
 */
function markDbUnhealthy() {
  if (dbHealthy) {
    logger.error('🔴 DATABASE MARKED UNHEALTHY - Blocking critical operations');
    dbHealthy = false;
  }
  
  // Don't schedule if a recovery check is already pending
  if (recoveryTimer) return;
  
  // Schedule recovery check
  recoveryTimer = setTimeout(async () => {
    recoveryTimer = null;
    try {
      await pool.query('SELECT 1');
      dbHealthy = true;
      logger.info('🟢 DATABASE RECOVERED - Resuming operations');
    } catch (error) {
      logger.warn('Database still unhealthy, will retry...');
      markDbUnhealthy(); // Retry
    }
  }, 10000).unref(); // Don't block process exit
}

/**
 * Check if database is healthy
 */
function isDbHealthy() {
  return dbHealthy;
}

/**
 * Periodic health check
 */
async function periodicHealthCheck() {
  if (Date.now() - lastHealthCheck < HEALTH_CHECK_INTERVAL) {
    return;
  }
  
  lastHealthCheck = Date.now();
  
  try {
    await pool.query('SELECT 1');
    if (!dbHealthy) {
      dbHealthy = true;
      logger.info('🟢 DATABASE RECOVERED - Resuming operations');
    }
  } catch (error) {
    markDbUnhealthy();
  }
}

/**
 * Circuit Breaker for database operations
 * Prevents cascading failures by temporarily blocking requests after repeated failures
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 30000) {
    this.failureCount = 0;
    this.threshold = threshold;
    this.timeout = timeout;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }

  async execute(operation, fallback = null) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        logger.warn('Circuit breaker OPEN - operation blocked');
        if (fallback) return fallback();
        throw new Error('Circuit breaker is OPEN');
      }
      // Reset failure count when entering HALF_OPEN to allow one clean probe
      this.failureCount = 0;
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info('Circuit breaker closed - connection restored');
    }
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.error(`Circuit breaker OPEN - too many failures (${this.failureCount})`);
      markDbUnhealthy(); // Mark DB as unhealthy globally
    }
  }

  reset() {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }
}

const circuitBreaker = new CircuitBreaker(5, 30000);

/**
 * Execute database operation with retry logic and circuit breaker
 * @param {Function} operation - Async function to execute
 * @param {Object} options - Configuration options
 * @returns {Promise<any>}
 */
async function executeDbOperation(operation, options = {}) {
  const {
    operationName = 'database operation',
    maxRetries = 3,
    retryDelay = 1000,
    useCircuitBreaker = true,
    fallback = null,
    critical = false // If true, throws error; if false, logs and continues
  } = options;

  const executeWithRetry = async () => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 1) {
          logger.info(`${operationName} succeeded on attempt ${attempt}`);
        }
        return result;
      } catch (error) {
        lastError = error;
        
        // Check if error is retryable
        const isRetryable = isRetryableError(error);
        
        if (!isRetryable || attempt === maxRetries) {
          logger.error(`${operationName} failed after ${attempt} attempt(s):`, {
            message: error.message,
            code: error.code,
            retryable: isRetryable
          });
          break;
        }

        const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        logger.warn(`${operationName} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`, {
          error: error.message,
          code: error.code
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Always throw so circuit breaker can track failures
    // The caller will handle critical vs non-critical behavior
    throw lastError;
  };

  if (useCircuitBreaker) {
    try {
      return await circuitBreaker.execute(executeWithRetry);
    } catch (error) {
      // Circuit breaker has tracked the failure
      // Now handle critical vs non-critical behavior
      if (critical) {
        throw error;
      }
      return fallback ? fallback() : null;
    }
  }
  
  // Without circuit breaker, handle errors directly
  try {
    return await executeWithRetry();
  } catch (error) {
    if (critical) {
      throw error;
    }
    return fallback ? fallback() : null;
  }
}

/**
 * Check if database error is retryable
 */
function isRetryableError(error) {
  const retryableCodes = [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    '57P01', // PostgreSQL: admin_shutdown
    '57P02', // PostgreSQL: crash_shutdown
    '57P03', // PostgreSQL: cannot_connect_now
    '08000', // PostgreSQL: connection_exception
    '08003', // PostgreSQL: connection_does_not_exist
    '08006', // PostgreSQL: connection_failure
    '08001', // PostgreSQL: sqlclient_unable_to_establish_sqlconnection
    '08004', // PostgreSQL: sqlserver_rejected_establishment_of_sqlconnection
  ];

  const retryableMessages = [
    'connection terminated',
    'connection timeout',
    'connection closed',
    'connection refused',
    'network error',
    'socket hang up',
    'ECONNRESET',
    'ETIMEDOUT'
  ];

  const errorCode = error.code || error.errno;
  const errorMessage = (error.message || '').toLowerCase();

  return retryableCodes.includes(errorCode) || 
         retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));
}

/**
 * Safe database query with automatic retry
 */
async function safeQuery(queryFn, options = {}) {
  return executeDbOperation(queryFn, {
    operationName: options.name || 'database query',
    ...options
  });
}

/**
 * Safe database transaction
 * 
 * IMPORTANT: Transaction retries can cause duplicate writes for non-idempotent operations.
 * If a failure occurs during/after COMMIT (e.g., network timeout where server committed 
 * but client didn't receive acknowledgment), the retry will execute the entire transaction 
 * again, potentially causing duplicate writes.
 * 
 * RECOMMENDATIONS:
 * - Ensure transaction logic is idempotent (safe to execute multiple times)
 * - Use unique constraints or conditional logic to prevent duplicates
 * - For critical non-idempotent operations, consider maxRetries: 1 (no retry)
 * 
 * @param {Function} transactionFn - Function that receives a pg client and executes queries
 * @param {Object} options - Configuration options
 * @returns {Promise<any>}
 */
async function safeTransaction(transactionFn, options = {}) {
  return executeDbOperation(
    async () => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await transactionFn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        // Guard ROLLBACK to preserve original error
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('ROLLBACK failed (connection may be broken):', {
            rollbackError: rollbackError.message,
            originalError: error.message
          });
          // Continue to throw original error, not rollback error
        }
        throw error;
      } finally {
        client.release();
      }
    },
    {
      operationName: options.name || 'database transaction',
      maxRetries: 1, // Reduced to 1 to minimize duplicate write risk
      ...options
    }
  );
}

module.exports = {
  executeDbOperation,
  safeQuery,
  safeTransaction,
  isRetryableError,
  circuitBreaker,
  isDbHealthy,
  markDbUnhealthy,
  periodicHealthCheck
};
