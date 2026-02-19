const userService = require('../services/user.service');
const logger = require('../utils/logger');

// Track rapid actions for flood detection
// NOTE: For multi-instance deployments, consider using Redis for shared rate-limiting state
const actionLog = new Map();
const FLOOD_WINDOW_MS = 10000; // 10 seconds
const FLOOD_LIMIT = 10; // max actions in window
const tempBlocked = new Map();
const BLOCK_DURATION_MS = 30000; // 30 second temp block

// Periodic cleanup every 60 seconds to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  
  // Clean up stale action logs
  for (const [userId, actions] of actionLog) {
    const recent = actions.filter(t => now - t < FLOOD_WINDOW_MS);
    if (recent.length === 0) {
      actionLog.delete(userId);
    } else {
      actionLog.set(userId, recent);
    }
  }
  
  // Clean up expired blocks
  for (const [userId, blockUntil] of tempBlocked) {
    if (now >= blockUntil) {
      tempBlocked.delete(userId);
    }
  }
  
  // Log cleanup stats if any entries were removed
  const actionLogSize = actionLog.size;
  const tempBlockedSize = tempBlocked.size;
  if (actionLogSize > 0 || tempBlockedSize > 0) {
    logger.debug(`Rate limit cleanup: ${actionLogSize} active users, ${tempBlockedSize} blocked users`);
  }
}, 60000);

/**
 * Bot protection middleware — blocks bots, forwarded-from-bot messages
 */
const botProtection = async (ctx, next) => {
  // Block bot accounts
  if (ctx.from?.is_bot) {
    logger.warn(`Blocked bot account: ${ctx.from.id}`);
    return;
  }

  // Block forwarded messages from bots (potential automation)
  if (ctx.message?.forward_from?.is_bot) {
    logger.warn(`Blocked forwarded bot message from user: ${ctx.from?.id}`);
    return;
  }

  return next();
};

/**
 * Flood detection middleware — temp-blocks users sending too many messages
 */
const floodProtection = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  // Check if user is temp blocked
  const blockUntil = tempBlocked.get(userId);
  if (blockUntil && Date.now() < blockUntil) {
    return; // silently ignore
  }
  if (blockUntil) {
    tempBlocked.delete(userId);
  }

  // Track actions
  const now = Date.now();
  const userActions = actionLog.get(userId) || [];
  // Keep only actions within the window
  const recentActions = userActions.filter(t => now - t < FLOOD_WINDOW_MS);
  recentActions.push(now);
  actionLog.set(userId, recentActions);

  if (recentActions.length > FLOOD_LIMIT) {
    tempBlocked.set(userId, now + BLOCK_DURATION_MS);
    logger.warn(`Flood detected — temp blocked user ${userId} for 30s`);
    await ctx.reply('⚠️ Too many requests! Please wait 30 seconds.').catch(() => {});
    return;
  }

  return next();
};

/**
 * Banned user middleware — blocks all actions from banned users
 */
const bannedCheck = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  try {
    const user = await userService.getUser(userId);
    if (user && user.isBanned) {
      await ctx.reply('🚫 Your account has been suspended. Contact support for assistance.').catch(() => {});
      return;
    }
    
    return next();
  } catch (error) {
    logger.error('Error in banned check:', error);
    // Fail-closed: block access on error to prevent bypassing ban check
    await ctx.reply('⚠️ Service temporarily unavailable. Please try again.').catch(() => {});
    return;
  }
};

/**
 * Contact-required gate — forces users to share contact before using features
 * Allows: /start, contact sharing
 */
const contactRequired = async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  // Always allow /start command and contact messages
  const isStartCommand = ctx.message?.text?.startsWith('/start');
  const isContactMessage = ctx.message?.contact;
  
  if (isStartCommand || isContactMessage) {
    return next();
  }

  try {
    const user = await userService.getUser(userId);
    
    // If user doesn't exist yet (hasn't done /start), let them through
    if (!user) return next();

    // If phone not verified, prompt
    if (!user.phoneVerified) {
      await ctx.reply(
        '📱 *Phone Verification Required*\n\nPlease share your contact to verify your account and receive your welcome bonus!\n\nTap the button below 👇',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: [
              [{ text: '📱 Share Contact', request_contact: true }],
            ],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        }
      );
      return;
    }
  } catch (error) {
    logger.error('Error in contact required check:', error);
  }

  return next();
};

module.exports = {
  botProtection,
  floodProtection,
  bannedCheck,
  contactRequired,
};
