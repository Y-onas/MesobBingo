require('dotenv').config();

/**
 * Helper to require environment variables
 * Fails fast if critical secrets are missing
 */
const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

/**
 * Helper to require environment variables in production only
 * Allows defaults in development for easier setup
 */
const requiredInProduction = (name, defaultValue) => {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable in production: ${name}`);
  }
  return value || defaultValue;
};

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  BOT_TOKEN: requiredEnv('BOT_TOKEN'),
  // BOT_USERNAME is now in system_config table - use configService.get('bot_username')
  DATABASE_URL: requiredEnv('DATABASE_URL'),
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean),
  // CHANNEL_ID, CHANNEL_URL, SUPPORT_USERNAME now in system_config - use configService
  // REFERRAL_BONUS now managed via referral_tiers table
  // MIN_DEPOSIT, MIN_WITHDRAW now in system_config - use configService
  // TELEBIRR_NUMBER, CBE_ACCOUNT now in payment_accounts table
  // Admin Dashboard API
  API_PORT: parseInt(process.env.API_PORT) || 3001,
  ADMIN_API_KEY: requiredInProduction('ADMIN_API_KEY', 'mesob-admin-secret'),
  JWT_SECRET: requiredInProduction('JWT_SECRET', 'mesob-jwt-secret-change-in-production'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5173',
  // Web App Configuration
  WEB_APP_URL: process.env.WEB_APP_URL || 'http://localhost:3001/game',
  WEB_APP_SECRET: requiredInProduction('WEB_APP_SECRET', 'mesob-web-app-secret-key-2024'),
  // Connection Limits (can be overridden in system_config)
  MAX_CONNECTIONS_PER_USER: parseInt(process.env.MAX_CONNECTIONS_PER_USER) || 2,
  MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 5,
  MAX_TOTAL_CONNECTIONS: parseInt(process.env.MAX_TOTAL_CONNECTIONS) || 1000,
  // Game Configuration (can be overridden in system_config)
  NUMBER_CALL_INTERVAL_MS: parseInt(process.env.NUMBER_CALL_INTERVAL_MS) || 2000,
  COUNTDOWN_SECONDS: parseInt(process.env.COUNTDOWN_SECONDS) || 120,
  BOARDS_PER_GAME: parseInt(process.env.BOARDS_PER_GAME) || 200,
};

