const { SESSION_STATES } = require('../utils/constants');

// In-memory session storage (use Redis for production)
const sessions = new Map();

// Session TTL configuration
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_SESSIONS = 10000; // Maximum number of sessions to keep

/**
 * Clean up expired sessions
 */
const cleanupExpiredSessions = () => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [userId, session] of sessions.entries()) {
    const sessionAge = now - new Date(session.lastActivity || session.createdAt).getTime();
    
    if (sessionAge > SESSION_TTL_MS) {
      sessions.delete(userId);
      cleanedCount++;
    }
  }
  
  // If still over limit, remove oldest sessions
  if (sessions.size > MAX_SESSIONS) {
    const sortedSessions = Array.from(sessions.entries())
      .sort((a, b) => {
        const aTime = new Date(a[1].lastActivity || a[1].createdAt).getTime();
        const bTime = new Date(b[1].lastActivity || b[1].createdAt).getTime();
        return aTime - bTime;
      });
    
    const toRemove = sessions.size - MAX_SESSIONS;
    for (let i = 0; i < toRemove; i++) {
      sessions.delete(sortedSessions[i][0]);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired sessions. Active sessions: ${sessions.size}`);
  }
};

// Start periodic cleanup
const cleanupInterval = setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);

// Cleanup on process exit
process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
});

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
      createdAt: new Date(),
      lastActivity: new Date()
    });
  } else {
    // Update last activity
    const session = sessions.get(userId);
    session.lastActivity = new Date();
  }
  
  // Attach session to context
  ctx.session = sessions.get(userId);
  
  await next();
  
  // Save session after handler
  ctx.session.lastActivity = new Date();
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
  sessions.set(userId, { 
    state: SESSION_STATES.NONE,
    createdAt: new Date(),
    lastActivity: new Date()
  });
};

/**
 * Get session statistics
 */
const getSessionStats = () => {
  return {
    totalSessions: sessions.size,
    maxSessions: MAX_SESSIONS,
    ttlHours: SESSION_TTL_MS / (60 * 60 * 1000)
  };
};

module.exports = { 
  sessionMiddleware, 
  getSession, 
  clearSession,
  getSessionStats,
  cleanupExpiredSessions
};
