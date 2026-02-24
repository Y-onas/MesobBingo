// ─── Admin Authentication & Authorization ───────────────────────────
// DB-based admin management with in-memory caching
// Supports: super_admin, admin, finance_admin, support_admin roles
// The admins table is the source of truth (not .env ADMIN_IDS)
// ────────────────────────────────────────────────────────────────────

const { db } = require('../database');
const { admins } = require('../database/schema');
const { eq, and } = require('drizzle-orm');
const logger = require('../utils/logger');

// Admin roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',           // NEW: Can do finance + support (but not manage admins or settings)
  FINANCE_ADMIN: 'finance_admin',
  SUPPORT_ADMIN: 'support_admin',
};

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.FINANCE_ADMIN]: 2,
  [ROLES.SUPPORT_ADMIN]: 1,
};

// ─── In-Memory Admin Cache ──────────────────────────────────────────
let adminCache = new Map();
let adminCacheExpiry = 0;
let lastSuccessfulRefresh = Date.now();
const ADMIN_CACHE_TTL = 60000; // 1 minute
const MAX_STALE_TTL = 300000; // 5 minutes - force cache miss if stale for too long

/**
 * Refresh admin cache if expired
 * @returns {boolean} true if cache was refreshed, false if using existing cache
 */
const refreshAdminCache = async () => {
  if (Date.now() < adminCacheExpiry) return false;

  try {
    const allAdmins = await db.select()
      .from(admins)
      .where(eq(admins.isActive, true));

    adminCache.clear();
    for (const admin of allAdmins) {
      adminCache.set(admin.telegramId, admin);
    }
    adminCacheExpiry = Date.now() + ADMIN_CACHE_TTL;
    lastSuccessfulRefresh = Date.now();
    return true;
  } catch (error) {
    const staleness = Date.now() - lastSuccessfulRefresh;
    logger.error(`Error refreshing admin cache (stale for ${Math.round(staleness / 1000)}s):`, error);
    
    // Force cache miss if stale for too long (security: revoked admins shouldn't be cached indefinitely)
    if (staleness > MAX_STALE_TTL) {
      logger.error('Admin cache exceeded max staleness, forcing cache miss');
      adminCache.clear();
      adminCacheExpiry = 0;
    }
    
    return false;
  }
};

/**
 * Check if user is admin (async, DB-based with caching)
 */
const isAdmin = async (userId) => {
  try {
    const didRefresh = await refreshAdminCache();
    
    // Check cache first
    if (adminCache.has(userId)) return true;

    // Only do DB fallback if cache was just refreshed (handles race conditions)
    // Otherwise return false immediately to avoid repeated DB queries for non-admins
    if (!didRefresh) return false;

    // Direct DB check as fallback (handles race condition after cache clear)
    const admin = await db.select()
      .from(admins)
      .where(and(
        eq(admins.telegramId, userId),
        eq(admins.isActive, true)
      ))
      .limit(1);

    return admin.length > 0;
  } catch (error) {
    logger.error('Error checking admin status:', error);
    return false;
  }
};

/**
 * Get admin role from database
 */
const getAdminRole = async (userId) => {
  try {
    await refreshAdminCache();
    const cached = adminCache.get(userId);
    if (cached) return cached.role;

    const admin = await db.select()
      .from(admins)
      .where(and(
        eq(admins.telegramId, userId),
        eq(admins.isActive, true)
      ))
      .limit(1);

    return admin.length > 0 ? admin[0].role : null;
  } catch (error) {
    logger.error('Error getting admin role:', error);
    return null;
  }
};

/**
 * Check if admin has required permission level
 * Super admins bypass all restrictions
 */
const hasPermission = async (userId, requiredRole) => {
  const userRole = await getAdminRole(userId);
  if (!userRole) return false;

  // Super admins can do anything
  if (userRole === ROLES.SUPER_ADMIN) return true;

  // Fail closed: deny access if requiredRole is invalid/unknown
  if (!ROLE_HIERARCHY[requiredRole]) return false;

  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
};

/**
 * Get all admins (active only by default)
 * @param {boolean} includeInactive - Set to true to include inactive admins
 */
const getAllAdmins = async (includeInactive = false) => {
  if (includeInactive) {
    return db.select().from(admins);
  }
  return db.select().from(admins).where(eq(admins.isActive, true));
};

/**
 * Get all active admins (convenience function)
 */
const getActiveAdmins = async () => {
  return db.select().from(admins).where(eq(admins.isActive, true));
};

/**
 * Clear admin cache (call after admin changes)
 */
const clearAdminCache = () => {
  adminCache.clear();
  adminCacheExpiry = 0;
};

module.exports = {
  ROLES,
  ROLE_HIERARCHY,
  isAdmin,
  getAdminRole,
  hasPermission,
  getAllAdmins,
  getActiveAdmins,
  clearAdminCache,
};
