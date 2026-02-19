const { SESSION_STATES } = require('../utils/constants');

/**
 * Deposit session manager
 */
class DepositSession {
  constructor() {
    this.sessions = new Map();
  }
  
  /**
   * Start deposit session
   */
  start(userId, method) {
    this.sessions.set(userId, {
      state: SESSION_STATES.AWAITING_DEPOSIT_SCREENSHOT,
      method,
      amount: null,
      screenshotFileId: null,
      transactionRef: null,
      createdAt: new Date()
    });
    return this.get(userId);
  }
  
  /**
   * Get deposit session
   */
  get(userId) {
    return this.sessions.get(userId);
  }
  
  /**
   * Update deposit session
   */
  update(userId, data) {
    const session = this.get(userId);
    if (session) {
      Object.assign(session, data);
    }
    return session;
  }
  
  /**
   * Clear deposit session
   */
  clear(userId) {
    this.sessions.delete(userId);
  }
  
  /**
   * Check if user has active deposit session
   */
  hasActive(userId) {
    return this.sessions.has(userId);
  }
}

module.exports = new DepositSession();
