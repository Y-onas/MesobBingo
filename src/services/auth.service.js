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
    
    logger.info(`Token generated for user ${telegramId} (${username}), expires at ${new Date(exp).toISOString()}`);
    
    return token;
  } catch (error) {
    logger.error('Error generating token:', error);
    throw error;
  }
};

module.exports = {
  generateToken,
};
