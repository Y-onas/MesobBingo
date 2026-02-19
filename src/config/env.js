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
  DATABASE_URL: requiredEnv('DATABASE_URL'),
  ADMIN_IDS: (process.env.ADMIN_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean),
  CHANNEL_ID: process.env.CHANNEL_ID || '@mesob_bingo_official',
  CHANNEL_URL: process.env.CHANNEL_URL || 'https://t.me/mesob_bingo_official',
  SUPPORT_USERNAME: process.env.SUPPORT_USERNAME || '@mesobbingosupport',
  REFERRAL_BONUS: parseInt(process.env.REFERRAL_BONUS) || 10,
  MIN_DEPOSIT: parseInt(process.env.MIN_DEPOSIT) || 50,
  MIN_WITHDRAW: parseInt(process.env.MIN_WITHDRAW) || 150,
  TELEBIRR_NUMBER: process.env.TELEBIRR_NUMBER || '0900000000',
  CBE_ACCOUNT: process.env.CBE_ACCOUNT || '1000000000000',
  // Admin Dashboard API
  API_PORT: parseInt(process.env.API_PORT) || 3001,
  ADMIN_API_KEY: requiredInProduction('ADMIN_API_KEY', 'mesob-admin-secret'),
  DASHBOARD_URL: process.env.DASHBOARD_URL || 'http://localhost:5173',
  // Web App Configuration
  WEB_APP_URL: process.env.WEB_APP_URL || 'http://localhost:3001/game',
  WEB_APP_SECRET: requiredInProduction('WEB_APP_SECRET', 'mesob-web-app-secret-key-2024'),
  // Connection Limits
  MAX_CONNECTIONS_PER_USER: parseInt(process.env.MAX_CONNECTIONS_PER_USER) || 2,
  MAX_CONNECTIONS_PER_IP: parseInt(process.env.MAX_CONNECTIONS_PER_IP) || 5,
  MAX_TOTAL_CONNECTIONS: parseInt(process.env.MAX_TOTAL_CONNECTIONS) || 1000,
  // Game Configuration
  NUMBER_CALL_INTERVAL_MS: parseInt(process.env.NUMBER_CALL_INTERVAL_MS) || 2000,
  COUNTDOWN_SECONDS: parseInt(process.env.COUNTDOWN_SECONDS) || 120,
  BOARDS_PER_GAME: parseInt(process.env.BOARDS_PER_GAME) || 200,
};

