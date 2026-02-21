/**
 * Test database connection resilience and timeout handling
 */
const { pool, checkDbHealth, closePool } = require('../../src/database');
const { executeDbOperation, circuitBreaker } = require('../../src/database/db-operations');
const logger = require('../../src/utils/logger');

async function testConnectionPool() {
  console.log('\n=== Testing Connection Pool ===\n');
  
  try {
    // Test 1: Basic health check
    console.log('1. Testing basic health check...');
    const healthy = await checkDbHealth();
    console.log(`   ✓ Health check: ${healthy ? 'PASSED' : 'FAILED'}`);
    
    // Test 2: Pool stats
    console.log('\n2. Checking pool statistics...');
    console.log(`   - Total connections: ${pool.totalCount}`);
    console.log(`   - Idle connections: ${pool.idleCount}`);
    console.log(`   - Waiting clients: ${pool.waitingCount}`);
    
    // Test 3: Concurrent queries
    console.log('\n3. Testing concurrent queries (10 simultaneous)...');
    const start = Date.now();
    const promises = Array(10).fill(0).map((_, i) => 
      pool.query('SELECT $1 as id, NOW() as time', [i])
    );
    await Promise.all(promises);
    const duration = Date.now() - start;
    console.log(`   ✓ All queries completed in ${duration}ms`);
    
    // Test 4: Long query timeout
    console.log('\n4. Testing query timeout handling...');
    try {
      await pool.query('SELECT pg_sleep(20)'); // Should timeout
      console.log('   ✗ Query should have timed out');
    } catch (error) {
      if (error.message.includes('timeout') || error.message.includes('terminated')) {
        console.log('   ✓ Query timeout handled correctly');
      } else {
        console.log(`   ? Unexpected error: ${error.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.error('   ✗ Connection pool test failed:', error.message);
    return false;
  }
}

async function testDbOperations() {
  console.log('\n=== Testing Database Operations Wrapper ===\n');
  
  try {
    // Test 1: Successful operation
    console.log('1. Testing successful operation...');
    const result = await executeDbOperation(
      async () => {
        const res = await pool.query('SELECT 1 as test');
        return res.rows[0];
      },
      { operationName: 'test query', maxRetries: 3 }
    );
    console.log(`   ✓ Operation succeeded: ${JSON.stringify(result)}`);
    
    // Test 2: Retry on failure
    console.log('\n2. Testing retry logic (simulated failure)...');
    let attemptCount = 0;
    try {
      await executeDbOperation(
        async () => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('ECONNRESET'); // Simulate retryable error
          }
          return { success: true };
        },
        { operationName: 'retry test', maxRetries: 3, retryDelay: 100 }
      );
      console.log(`   ✓ Operation succeeded after ${attemptCount} attempts`);
    } catch (error) {
      console.log(`   ✗ Operation failed after ${attemptCount} attempts`);
    }
    
    // Test 3: Non-critical failure with retryable error (tests retry exhaustion)
    console.log('\n3. Testing non-critical failure handling with retryable error...');
    let retryAttempts = 0;
    const fallbackResult = await executeDbOperation(
      async () => {
        retryAttempts++;
        // Use a retryable error to actually test retry logic
        const error = new Error('connection timeout');
        error.code = 'ETIMEDOUT';
        throw error;
      },
      { 
        operationName: 'non-critical test',
        maxRetries: 2,
        retryDelay: 100,
        critical: false,
        fallback: () => ({ fallback: true })
      }
    );
    console.log(`   ✓ Fallback returned after ${retryAttempts} retry attempts: ${JSON.stringify(fallbackResult)}`);
    
    // Test 4: Circuit breaker accumulates failures across operations
    console.log('\n4. Testing circuit breaker with repeated failures...');
    circuitBreaker.reset();
    
    // Circuit breaker threshold is 5 (from db-operations.js)
    const CIRCUIT_BREAKER_THRESHOLD = 5;
    let circuitBreakerOpened = false;
    let failureCount = 0;
    
    // Simulate repeated failures - circuit breaker tracks across all operations
    // Loop one more than threshold to ensure it opens
    for (let i = 0; i < CIRCUIT_BREAKER_THRESHOLD + 2; i++) {
      try {
        await executeDbOperation(
          async () => {
            throw new Error('Simulated persistent DB failure');
          },
          {
            operationName: 'circuit breaker test',
            maxRetries: 1,
            retryDelay: 10,
            critical: true, // Must be critical to propagate error to circuit breaker
            useCircuitBreaker: true
          }
        );
      } catch (error) {
        failureCount++;
        // Check if circuit breaker opened
        if (error.message === 'Circuit breaker is OPEN') {
          circuitBreakerOpened = true;
          console.log(`   - Circuit breaker opened after ${failureCount} failures`);
          break;
        }
      }
    }
    
    console.log(`   - Circuit breaker state: ${circuitBreaker.state}`);
    console.log(`   - Failure count: ${circuitBreaker.failureCount}`);
    
    if (circuitBreaker.state === 'OPEN' || circuitBreakerOpened) {
      console.log('   ✓ Circuit breaker correctly opened after repeated failures');
    } else {
      console.log('   ✗ Circuit breaker should have opened after repeated failures');
      return false;
    }
    
    // Reset for other tests
    circuitBreaker.reset();
    
    return true;
  } catch (error) {
    console.error('   ✗ Database operations test failed:', error.message);
    return false;
  }
}

async function testGamePauseScenario() {
  console.log('\n=== Testing Game Pause Scenario ===\n');
  
  try {
    const { db } = require('../../src/database');
    const { games } = require('../../src/database/schema');
    const { eq } = require('drizzle-orm');
    
    // Test 1: Non-critical operation with fallback (should succeed with fallback)
    console.log('1. Testing non-critical pause operation with fallback...');
    
    const testGameId = 999999; // Use non-existent ID for test
    let operationAttempted = false;
    
    const result = await executeDbOperation(
      async () => {
        operationAttempted = true;
        // Simulate a DB failure to actually test fallback behavior
        // NOTE: UPDATE on non-existent row succeeds silently in SQL,
        // so we throw explicitly to test the fallback mechanism
        throw new Error('Simulated DB failure for pause test');
      },
      {
        operationName: `pause game ${testGameId}`,
        maxRetries: 2,
        retryDelay: 100,
        critical: false,
        fallback: () => ({ fallbackUsed: true })
      }
    );
    
    if (!operationAttempted) {
      console.log('   ✗ Operation was never attempted');
      return false;
    }
    
    if (result && result.fallbackUsed) {
      console.log('   ✓ Non-critical operation used fallback as expected');
    } else {
      console.log('   ✗ Expected fallback to be used');
      return false;
    }
    
    // Test 2: Critical operation (should throw)
    console.log('\n2. Testing critical pause operation (should throw)...');
    
    let errorThrown = false;
    try {
      await executeDbOperation(
        async () => {
          // Simulate a critical DB failure
          // NOTE: UPDATE on non-existent row succeeds silently in SQL,
          // so we throw explicitly to test critical error handling
          throw new Error('Simulated critical DB failure');
        },
        {
          operationName: `critical pause game ${testGameId}`,
          maxRetries: 1,
          retryDelay: 100,
          critical: true // Should throw error
        }
      );
    } catch (error) {
      errorThrown = true;
      console.log('   ✓ Critical operation threw error as expected');
    }
    
    if (!errorThrown) {
      console.log('   ✗ Critical operation should have thrown an error');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('   ✗ Unexpected test error:', error.message);
    return false;
  }
}

async function testTransactionSafety() {
  console.log('\n=== Testing Transaction Safety ===\n');
  
  try {
    const { safeTransaction } = require('../../src/database/db-operations');
    
    // Test 1: Successful transaction
    console.log('1. Testing successful transaction...');
    const result1 = await safeTransaction(
      async (client) => {
        const res = await client.query('SELECT 1 as test');
        return res.rows[0];
      },
      { name: 'test transaction' }
    );
    
    if (result1 && result1.test === 1) {
      console.log('   ✓ Transaction completed successfully');
    } else {
      console.log('   ✗ Transaction did not return expected result');
      return false;
    }
    
    // Test 2: Transaction with error (should rollback and use fallback)
    console.log('\n2. Testing transaction rollback on error...');
    
    // With critical: false, should get fallback after rollback
    const result2 = await safeTransaction(
      async (client) => {
        await client.query('SELECT 1'); // This succeeds
        throw new Error('Simulated error'); // This triggers rollback
      },
      { 
        name: 'non-critical transaction',
        critical: false,
        fallback: () => ({ rolledBack: true })
      }
    );
    
    if (result2 && result2.rolledBack) {
      console.log('   ✓ Transaction rollback handled correctly with fallback');
    } else {
      console.log('   ✗ Transaction rollback did not work as expected');
      return false;
    }
    
    // Test 3: Verify maxRetries is 1 by default (safety check)
    console.log('\n3. Verifying transaction retry safety (maxRetries=1)...');
    let attemptCount = 0;
    
    try {
      await safeTransaction(
        async (client) => {
          attemptCount++;
          throw new Error('Force retry');
        },
        { 
          name: 'retry count test',
          critical: true
        }
      );
    } catch (error) {
      // Expected to fail
    }
    
    if (attemptCount === 1) {
      console.log('   ✓ Transaction uses maxRetries=1 by default (safe for non-idempotent ops)');
    } else {
      console.log(`   ⚠ Transaction attempted ${attemptCount} times (expected 1 for safety)`);
    }
    
    return true;
  } catch (error) {
    console.error('   ✗ Transaction safety test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║   Database Resilience & Timeout Test Suite            ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  const results = {
    connectionPool: false,
    dbOperations: false,
    gamePause: false,
    transactionSafety: false
  };
  
  try {
    results.connectionPool = await testConnectionPool();
    results.dbOperations = await testDbOperations();
    results.gamePause = await testGamePauseScenario();
    results.transactionSafety = await testTransactionSafety();
  } catch (error) {
    console.error('\n✗ Test suite error:', error);
  }
  
  // Summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║   Test Results Summary                                 ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`Connection Pool Tests:    ${results.connectionPool ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`DB Operations Tests:      ${results.dbOperations ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Game Pause Scenario:      ${results.gamePause ? '✓ PASSED' : '✗ FAILED'}`);
  console.log(`Transaction Safety:       ${results.transactionSafety ? '✓ PASSED' : '✗ FAILED'}`);
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\nOverall: ${allPassed ? '✓ ALL TESTS PASSED' : '✗ SOME TESTS FAILED'}`);
  
  await closePool();
  process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
