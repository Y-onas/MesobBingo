const { Telegraf } = require('telegraf');
const { BOT_TOKEN } = require('../config/env');

/**
 * Telegram bot singleton for sending messages from the API server.
 * Uses a lightweight Telegraf instance (no middleware/handlers needed).
 */
let telegramBot = null;

const getTelegramBot = () => {
  if (!telegramBot && BOT_TOKEN) {
    telegramBot = new Telegraf(BOT_TOKEN);
  }
  return telegramBot;
};

/**
 * Send a message to a user via Telegram
 */
const notifyUser = async (telegramId, message) => {
  try {
    const bot = getTelegramBot();
    if (bot) {
      await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    // User may have blocked the bot
    console.error(`Failed to notify user ${telegramId}:`, err.message);
  }
};

module.exports = { getTelegramBot, notifyUser };
