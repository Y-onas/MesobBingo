// Enhanced rate limiting middleware

const userLastAction = new Map();
const RATE_LIMIT_MS = 1000; // 1 second between actions

/**
 * Rate limiting middleware
 */
const rateMiddleware = async (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId) {
    return next();
  }

  const now = Date.now();
  const lastAction = userLastAction.get(userId) || 0;

  if (now - lastAction < RATE_LIMIT_MS) {
    // Too fast, ignore
    return;
  }

  userLastAction.set(userId, now);
  return next();
};

module.exports = { rateMiddleware };
