const { db, pool } = require('./index');
const logger = require('../utils/logger');

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

    if (critical) {
      throw lastError;
    }
    
    return fallback ? fallback() : null;
  };

  if (useCircuitBreaker) {
    return circuitBreaker.execute(executeWithRetry, fallback);
  }
  
  return executeWithRetry();
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
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    {
      operationName: options.name || 'database transaction',
      maxRetries: 2, // Fewer retries for transactions
      ...options
    }
  );
}

module.exports = {
  executeDbOperation,
  safeQuery,
  safeTransaction,
  isRetryableError,
  circuitBreaker
};
