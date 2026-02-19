const { Telegraf } = require('telegraf');
const { BOT_TOKEN } = require('./config/env');
const logger = require('./utils/logger');

// Security Middlewares
const { botProtection, floodProtection, bannedCheck, contactRequired } = require('./middlewares/security.middleware');

// Core Middlewares
const { sessionMiddleware } = require('./middlewares/session.middleware');
const { rateMiddleware } = require('./middlewares/rate.middleware');
const { checkAdmin } = require('./middlewares/auth.middleware');

// Commands
const startCommand = require('./commands/user/start.command');
const playCommand = require('./commands/user/play.command');
const depositCommand = require('./commands/user/deposit.command');
const withdrawCommand = require('./commands/user/withdraw.command');
const balanceCommand = require('./commands/user/balance.command');
const inviteCommand = require('./commands/user/invite.command');
const helpCommand = require('./commands/user/help.command');

// Admin Commands
const postCommand = require('./commands/admin/post.command');
const bonusCommand = require('./commands/admin/bonus.command');
const transferCommand = require('./commands/admin/transfer.command');
const usersCommand = require('./commands/admin/users.command');

// Actions
const paymentAction = require('./actions/payment.action');
const withdrawAction = require('./actions/withdraw.action');
const gameAction = require('./actions/game.action');
const adminAction = require('./actions/admin.action');

// Handlers
const textHandler = require('./handlers/text.handler');
const photoHandler = require('./handlers/photo.handler');
const contactHandler = require('./handlers/contact.handler');
const documentHandler = require('./handlers/document.handler');

/**
 * Create and configure bot
 */
const createBot = () => {
  if (!BOT_TOKEN) {
    logger.error('BOT_TOKEN is not set in environment variables');
    process.exit(1);
  }

  const bot = new Telegraf(BOT_TOKEN);

  // ─── Security middlewares (first layer) ─────────────────────────────
  bot.use(botProtection);      // Block bots
  bot.use(floodProtection);    // Flood detection (30s temp block)
  bot.use(rateMiddleware);     // Basic rate limiting (1s cooldown)

  // ─── Core middlewares ───────────────────────────────────────────────
  bot.use(sessionMiddleware);
  bot.use(checkAdmin);
  bot.use(bannedCheck);        // Block banned users
  bot.use(contactRequired);    // Force phone verification

  // Register user commands
  startCommand.register(bot);
  playCommand.register(bot);
  depositCommand.register(bot);
  withdrawCommand.register(bot);
  balanceCommand.register(bot);
  inviteCommand.register(bot);
  helpCommand.register(bot);

  // Register additional commands
  bot.command('contact', async (ctx) => {
    const { SUPPORT_USERNAME } = require('./config/env');
    await ctx.reply(`🏪 *Contact Us*\n\nSupport: ${SUPPORT_USERNAME}`, { parse_mode: 'Markdown' });
  });

  bot.command('join', async (ctx) => {
    const { CHANNEL_URL } = require('./config/env');
    await ctx.reply(`👥 *Join Us*\n\nJoin our channel: ${CHANNEL_URL}`, { parse_mode: 'Markdown' });
  });

  // Register admin commands
  postCommand.register(bot);
  bonusCommand.register(bot);
  transferCommand.register(bot);
  usersCommand.register(bot);

  // Register actions (inline button callbacks)
  paymentAction.register(bot);
  withdrawAction.register(bot);
  gameAction.register(bot);
  adminAction.register(bot);

  // Register message handlers
  photoHandler.register(bot);
  contactHandler.register(bot);
  documentHandler.register(bot);
  textHandler.register(bot); // Must be last to catch remaining text

  // Error handling
  bot.catch((err, ctx) => {
    logger.error('Bot error:', err);
    ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
  });

  logger.info('Bot configured successfully with security features');

  return bot;
};

module.exports = { createBot };
