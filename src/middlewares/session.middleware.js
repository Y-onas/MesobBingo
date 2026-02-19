const { SESSION_STATES } = require('../utils/constants');

// In-memory session storage (use Redis for production)
const sessions = new Map();

/**
 * Session middleware
 */
const sessionMiddleware = async (ctx, next) => {
  const userId = ctx.from?.id;
  
  if (!userId) {
    return next();
  }
  
  // Get or create session
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      state: SESSION_STATES.NONE,
      createdAt: new Date()
    });
  }
  
  // Attach session to context
  ctx.session = sessions.get(userId);
  
  await next();
  
  // Save session after handler
  sessions.set(userId, ctx.session);
};

/**
 * Get session for user
 */
const getSession = (userId) => {
  return sessions.get(userId) || { state: SESSION_STATES.NONE };
};

/**
 * Clear session for user
 */
const clearSession = (userId) => {
  sessions.set(userId, { state: SESSION_STATES.NONE });
};

module.exports = { sessionMiddleware, getSession, clearSession };
