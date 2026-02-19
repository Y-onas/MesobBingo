const { RATE_LIMITS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Sliding Window Rate Limiter
 * Tracks per-key request timestamps, removes expired entries
 */
class SlidingWindowRateLimiter {
  constructor() {
    this.requests = new Map(); // key → number[]

    // Cleanup old entries every 60 seconds
    this._cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if a request is allowed under a rate limit
   * @param {string} key - Unique key (e.g., socketId, telegramId, ip)
   * @param {number} limit - Max allowed requests in window
   * @param {number} windowMs - Window size in ms
   * @returns {boolean} true if allowed
   */
  isAllowed(key, limit, windowMs) {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove expired timestamps
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= limit) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  /**
   * Check global rate limit for a connection
   */
  checkGlobal(socketId) {
    return this.isAllowed(`global:${socketId}`, RATE_LIMITS.GLOBAL.max, RATE_LIMITS.GLOBAL.windowMs);
  }

  /**
   * Check bingo claim rate limit
   */
  checkBingoClaim(socketId) {
    return this.isAllowed(`bingo:${socketId}`, RATE_LIMITS.BINGO_CLAIM.max, RATE_LIMITS.BINGO_CLAIM.windowMs);
  }

  /**
   * Check join game rate limit
   */
  checkJoinGame(socketId) {
    return this.isAllowed(`join:${socketId}`, RATE_LIMITS.JOIN_GAME.max, RATE_LIMITS.JOIN_GAME.windowMs);
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests) {
      const valid = timestamps.filter(t => now - t < 60000);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }

  /**
   * Remove all entries for a key
   */
  remove(key) {
    // Remove all keys starting with this pattern
    for (const k of this.requests.keys()) {
      if (k.includes(key)) {
        this.requests.delete(k);
      }
    }
  }

  /**
   * Shutdown cleanup interval
   */
  destroy() {
    clearInterval(this._cleanupInterval);
    this.requests.clear();
  }
}

/**
 * IP Reputation Tracker
 */
class IPReputationTracker {
  constructor() {
    this.scores = new Map(); // ip → score
    this.banned = new Set();  // banned IPs

    // Decay scores every hour
    this._decayInterval = setInterval(() => this.decay(), 3600000);
  }

  recordViolation(ip, severity = 1) {
    const current = this.scores.get(ip) || 0;
    const newScore = current + severity;
    this.scores.set(ip, newScore);

    if (newScore > 100) {
      this.ban(ip);
    }

    return newScore;
  }

  ban(ip) {
    this.banned.add(ip);
    logger.warn(`IP banned: ${ip}`);
  }

  isBanned(ip) {
    return this.banned.has(ip);
  }

  decay() {
    for (const [ip, score] of this.scores) {
      const newScore = Math.max(0, score - 10);
      if (newScore === 0) {
        this.scores.delete(ip);
      } else {
        this.scores.set(ip, newScore);
      }
    }
  }

  destroy() {
    clearInterval(this._decayInterval);
    this.scores.clear();
    this.banned.clear();
  }
}

module.exports = { SlidingWindowRateLimiter, IPReputationTracker };
