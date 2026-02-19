const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Get the secret key from environment variables
 */
const getSecret = () => {
  const secret = process.env.WEB_APP_SECRET;
  if (!secret) {
    throw new Error('WEB_APP_SECRET environment variable is not set');
  }
  return secret;
};

/**
 * Generate authentication token for web game access
 * @param {number} telegramId - User's Telegram ID
 * @param {string} username - User's Telegram username
 * @param {number} expiresIn - Token expiration time in milliseconds (default: 1 hour)
 * @returns {string} Signed authentication token (Base64-encoded JSON)
 */
const generateToken = (telegramId, username = 'user', expiresIn = 3600000) => {
  try {
    const secret = getSecret();
    
    // Calculate expiration timestamp
    const exp = Date.now() + expiresIn;
    
    // Create payload without signature first
    const payload = {
      telegramId,
      username,
      exp,
    };
    
    // Generate HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const signature = hmac.digest('hex');
    
    // Add signature to payload
    payload.signature = signature;
    
    // Encode as Base64 JSON string
    const token = Buffer.from(JSON.stringify(payload)).toString('base64');
    
    logger.debug(`Token generated, expires at ${new Date(exp).toISOString()}`);
    
    return token;
  } catch (error) {
    logger.error('Error generating token:', error);
    throw error;
  }
};

/**
 * Verify authentication token
 * @param {string} token - Base64-encoded token to verify
 * @returns {Object|null} Decoded payload if valid, null if invalid
 */
const verifyToken = (token) => {
  try {
    const secret = getSecret();
    
    // Decode Base64 token
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check required fields
    if (!decoded.telegramId || !decoded.exp || !decoded.signature) {
      logger.debug('Token missing required fields');
      return null;
    }
    
    // Check expiration
    if (Date.now() > decoded.exp) {
      logger.debug('Token expired');
      return null;
    }
    
    // Extract signature and create payload for verification
    const { signature: providedSignature, ...payload } = decoded;
    
    // Recompute signature using same method as generation
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    const computedSignature = hmac.digest('hex');
    
    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(computedSignature, 'hex')
    )) {
      logger.debug('Token signature verification failed');
      return null;
    }
    
    // Token is valid, return payload without signature
    return payload;
  } catch (error) {
    logger.debug('Token verification error:', error.message);
    return null;
  }
};

module.exports = {
  generateToken,
  verifyToken,
};
