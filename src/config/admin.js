// ─── Admin Authentication & Authorization ───────────────────────────
// DB-based admin management with in-memory caching
// Supports: super_admin, finance_admin, support_admin roles
// The admins table is the source of truth (not .env ADMIN_IDS)
// ────────────────────────────────────────────────────────────────────

const { db } = require('../database');
const { admins } = require('../database/schema');
const { eq, and } = require('drizzle-orm');

// Admin roles
const ROLES = {
  SUPER_ADMIN: 'super_admin',
  FINANCE_ADMIN: 'finance_admin',
  SUPPORT_ADMIN: 'support_admin',
};

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY = {
  [ROLES.SUPER_ADMIN]: 3,
  [ROLES.FINANCE_ADMIN]: 2,
  [ROLES.SUPPORT_ADMIN]: 1,
};

// ─── In-Memory Admin Cache ──────────────────────────────────────────
let adminCache = new Map();
let adminCacheExpiry = 0;
const ADMIN_CACHE_TTL = 60000; // 1 minute

/**
 * Refresh admin cache if expired
 */
const refreshAdminCache = async () => {
  if (Date.now() < adminCacheExpiry) return;

  try {
    const allAdmins = await db.select()
      .from(admins)
      .where(eq(admins.isActive, true));

    adminCache.clear();
    for (const admin of allAdmins) {
      adminCache.set(admin.telegramId, admin);
    }
    adminCacheExpiry = Date.now() + ADMIN_CACHE_TTL;
  } catch (error) {
    console.error('Error refreshing admin cache:', error);
    // Keep using stale cache if DB fails
  }
};

/**
 * Check if user is admin (async, DB-based with caching)
 */
const isAdmin = async (userId) => {
  try {
    await refreshAdminCache();
    if (adminCache.has(userId)) return true;

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
    console.error('Error checking admin status:', error);
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
    console.error('Error getting admin role:', error);
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

  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
};

/**
 * Get all admins
 */
const getAllAdmins = async () => {
  return db.select().from(admins);
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
  clearAdminCache,
};
