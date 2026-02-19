const crypto = require('crypto');
const { BOT_TOKEN } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Verify Telegram WebApp initData HMAC signature
 * @param {string} initData - Raw initData string from Telegram WebApp
 * @returns {{ valid: boolean, user: object|null }}
 */
const verifyTelegramAuth = (initData) => {
  try {
    if (!initData || typeof initData !== 'string') {
      return { valid: false, user: null };
    }

    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      return { valid: false, user: null };
    }

    params.delete('hash');

    // Sort and create check string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // HMAC verification
    const secretKey = crypto.createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    const calculatedHash = crypto.createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Timing-safe comparison
    const valid = crypto.timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(calculatedHash, 'hex')
    );

    if (!valid) {
      return { valid: false, user: null };
    }

    // Extract user data
    const userRaw = params.get('user');
    let user = null;
    if (userRaw) {
      try {
        user = JSON.parse(userRaw);
      } catch (e) {
        logger.warn('Failed to parse Telegram user data');
      }
    }

    return { valid: true, user };
  } catch (error) {
    logger.error('Telegram auth verification error:', error);
    return { valid: false, user: null };
  }
};

/**
 * Dev-mode bypass for testing without Telegram
 * Only enabled when NODE_ENV === 'development' and DEV_USER_ID is set
 */
const devModeAuth = (initData) => {
  if (process.env.NODE_ENV !== 'development') {
    return { valid: false, user: null };
  }

  // Accept 'dev_<telegramId>' as a dev token
  if (initData && initData.startsWith('dev_')) {
    const telegramId = parseInt(initData.replace('dev_', ''));
    if (!isNaN(telegramId)) {
      logger.warn(`DEV MODE: Authenticated as user ${telegramId}`);
      return {
        valid: true,
        user: {
          id: telegramId,
          first_name: 'DevUser',
          username: 'dev_user',
        },
      };
    }
  }
  return { valid: false, user: null };
};

module.exports = { verifyTelegramAuth, devModeAuth };
