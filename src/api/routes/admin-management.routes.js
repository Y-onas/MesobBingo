// ─── Admin Management API Routes ────────────────────────────────────
// SUPER_ADMIN only: manage admin users (add, deactivate, change roles)
// ────────────────────────────────────────────────────────────────────

const { Router } = require('express');
const { db } = require('../../database');
const { admins, auditLogs } = require('../../database/schema');
const { eq } = require('drizzle-orm');
const { ROLES, hasPermission, clearAdminCache, getAllAdmins } = require('../../config/admin');
const logger = require('../../utils/logger');

const router = Router();

/**
 * GET /api/admin/admins — List all admins (SUPER_ADMIN only)
 */
router.get('/', async (req, res) => {
  try {
    const adminId = req.adminId;
    if (!await hasPermission(adminId, ROLES.SUPER_ADMIN)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const allAdmins = await getAllAdmins(true); // Include inactive for admin management UI
    res.json(allAdmins);
  } catch (error) {
    logger.error('Error fetching admins:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/admins — Add new admin (SUPER_ADMIN only)
 */
router.post('/', async (req, res) => {
  try {
    const adminId = req.adminId;
    if (!await hasPermission(adminId, ROLES.SUPER_ADMIN)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const { telegramId, name, email, role } = req.body;

    if (!telegramId || !name) {
      return res.status(400).json({ error: 'telegramId and name are required' });
    }

    const parsedTelegramId = parseInt(telegramId);
    if (isNaN(parsedTelegramId)) {
      return res.status(400).json({ error: 'telegramId must be a valid number' });
    }

    // Validate role
    if (role && !Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [newAdmin] = await db.insert(admins).values({
      telegramId: parsedTelegramId,
      name,
      email: email || null,
      role: role || ROLES.SUPPORT_ADMIN,
      isActive: true,
    }).returning();

    // Clear cache so new admin is recognized immediately
    clearAdminCache();

    // Audit log
    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName: req.adminName || `Admin ${adminId}`,
      actionType: 'admin_added',
      details: `Added admin: ${name} (${telegramId}) with role ${role || ROLES.SUPPORT_ADMIN}`,
      ipAddress: req.adminIp || req.ip,
    });

    logger.info(`Admin added: ${name} (${telegramId}) by ${adminId}`);
    res.json(newAdmin);
  } catch (error) {
    logger.error('Error adding admin:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Admin with this Telegram ID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/admins/:id/deactivate — Deactivate admin (SUPER_ADMIN only)
 */
router.patch('/:id/deactivate', async (req, res) => {
  try {
    const requesterId = req.adminId;
    if (!await hasPermission(requesterId, ROLES.SUPER_ADMIN)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetId = parseInt(req.params.id);

    // Prevent self-deactivation
    const [target] = await db.select().from(admins).where(eq(admins.id, targetId));
    if (target && String(target.telegramId) === String(requesterId)) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const [updated] = await db.update(admins)
      .set({ isActive: false })
      .where(eq(admins.id, targetId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    clearAdminCache();

    await db.insert(auditLogs).values({
      adminId: String(requesterId),
      adminName: req.adminName || `Admin ${requesterId}`,
      actionType: 'admin_deactivated',
      details: `Deactivated admin: ${updated.name} (${updated.telegramId})`,
      ipAddress: req.adminIp || req.ip,
    });

    logger.info(`Admin deactivated: ${updated.name} (${updated.telegramId}) by ${requesterId}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error deactivating admin:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/admins/:id/activate — Reactivate admin (SUPER_ADMIN only)
 */
router.patch('/:id/activate', async (req, res) => {
  try {
    const requesterId = req.adminId;
    if (!await hasPermission(requesterId, ROLES.SUPER_ADMIN)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetId = parseInt(req.params.id);

    const [updated] = await db.update(admins)
      .set({ isActive: true })
      .where(eq(admins.id, targetId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    clearAdminCache();

    await db.insert(auditLogs).values({
      adminId: String(requesterId),
      adminName: req.adminName || `Admin ${requesterId}`,
      actionType: 'admin_reactivated',
      details: `Reactivated admin: ${updated.name} (${updated.telegramId})`,
      ipAddress: req.adminIp || req.ip,
    });

    logger.info(`Admin reactivated: ${updated.name} (${updated.telegramId}) by ${requesterId}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error reactivating admin:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/admin/admins/:id/role — Update admin role (SUPER_ADMIN only)
 */
router.patch('/:id/role', async (req, res) => {
  try {
    const requesterId = req.adminId;
    if (!await hasPermission(requesterId, ROLES.SUPER_ADMIN)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const targetId = parseInt(req.params.id);
    const { role } = req.body;

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const [updated] = await db.update(admins)
      .set({ role })
      .where(eq(admins.id, targetId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    clearAdminCache();

    await db.insert(auditLogs).values({
      adminId: String(requesterId),
      adminName: req.adminName || `Admin ${requesterId}`,
      actionType: 'admin_role_updated',
      details: `Updated admin role: ${updated.name} → ${role}`,
      ipAddress: req.adminIp || req.ip,
    });

    logger.info(`Admin role updated: ${updated.name} → ${role} by ${requesterId}`);
    res.json(updated);
  } catch (error) {
    logger.error('Error updating admin role:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
