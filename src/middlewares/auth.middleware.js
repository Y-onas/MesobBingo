const { isAdmin } = require('../config/admin');
const configService = require('../services/config.service');

/**
 * Admin-only middleware
 */
const adminOnly = async (ctx, next) => {
  if (!await isAdmin(ctx.from.id)) {
    const msg = await configService.getMessage('msg_admin_only', {}, '⚠️ This command is for admins only.');
    return ctx.reply(msg);
  }
  return next();
};

/**
 * Check if user is admin (non-blocking)
 */
const checkAdmin = async (ctx, next) => {
  ctx.isAdmin = await isAdmin(ctx.from.id);
  return next();
};

module.exports = { adminOnly, checkAdmin };
