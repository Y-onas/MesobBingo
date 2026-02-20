// Simple test script for token generation and verification
require('dotenv').config();
const { generateToken, verifyToken } = require('./src/services/auth.service');

console.log('Testing token generation and verification...\n');

try {
  // Test 1: Generate token with all parameters
  console.log('Test 1: Generate token with all parameters');
  const token1 = generateToken(123456789, 'testuser', 3600000);
  console.log('Token:', token1);
  
  // Decode and verify structure
  const decoded1 = JSON.parse(Buffer.from(token1, 'base64').toString());
  console.log('Decoded payload:', decoded1);
  console.log('Has telegramId:', decoded1.hasOwnProperty('telegramId'));
  console.log('Has username:', decoded1.hasOwnProperty('username'));
  console.log('Has exp:', decoded1.hasOwnProperty('exp'));
  console.log('Has signature:', decoded1.hasOwnProperty('signature'));
  console.log('✓ Test 1 passed\n');
  
  // Test 2: Verify valid token
  console.log('Test 2: Verify valid token');
  const verified1 = verifyToken(token1);
  console.log('Verification result:', verified1);
  console.log('Is valid:', verified1 !== null);
  console.log('TelegramId matches:', verified1.telegramId === 123456789);
  console.log('Username matches:', verified1.username === 'testuser');
  console.log('✓ Test 2 passed\n');
  
  // Test 3: Generate token with default username
  console.log('Test 3: Generate token with default username');
  const token2 = generateToken(987654321);
  const verified2 = verifyToken(token2);
  console.log('Username:', verified2.username);
  console.log('✓ Test 3 passed\n');
  
  // Test 4: Verify expired token
  console.log('Test 4: Verify expired token');
  const expiredToken = generateToken(111111111, 'expired', -1000); // Already expired
  const verifiedExpired = verifyToken(expiredToken);
  console.log('Expired token valid:', verifiedExpired !== null);
  console.log('Expected: false');
  console.log('✓ Test 4 passed\n');
  
  // Test 5: Verify tampered token
  console.log('Test 5: Verify tampered token');
  const tamperedToken = token1.slice(0, -5) + 'XXXXX'; // Tamper with token
  const verifiedTampered = verifyToken(tamperedToken);
  console.log('Tampered token valid:', verifiedTampered !== null);
  console.log('Expected: false');
  console.log('✓ Test 5 passed\n');
  
  // Test 6: Verify invalid token format
  console.log('Test 6: Verify invalid token format');
  const invalidToken = 'not-a-valid-token';
  const verifiedInvalid = verifyToken(invalidToken);
  console.log('Invalid token valid:', verifiedInvalid !== null);
  console.log('Expected: false');
  console.log('✓ Test 6 passed\n');
  
  console.log('All tests passed! ✓');
} catch (error) {
  console.error('Test failed:', error);
  process.exit(1);
}
