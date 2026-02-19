const { isAdmin } = require('../config/admin');
const { MESSAGES } = require('../utils/constants');

/**
 * Admin-only middleware
 */
const adminOnly = async (ctx, next) => {
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply(MESSAGES.ADMIN_ONLY);
  }
  return next();
};

/**
 * Check if user is admin (non-blocking)
 */
const checkAdmin = async (ctx, next) => {
  ctx.isAdmin = isAdmin(ctx.from.id);
  return next();
};

module.exports = { adminOnly, checkAdmin };
