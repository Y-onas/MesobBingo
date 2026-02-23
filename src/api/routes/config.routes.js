// ─── System Configuration API Routes ────────────────────────────────
// Manages dynamic configuration, referral tiers, and payment accounts
// ────────────────────────────────────────────────────────────────────

const { Router } = require('express');
const configService = require('../../services/config.service');
const { getAdminRole } = require('../../config/admin');
const { db } = require('../../database');
const { auditLogs } = require('../../database/schema');
const logger = require('../../utils/logger');

const router = Router();

/**
 * GET /api/configs — List all configs
 */
router.get('/', async (req, res) => {
  try {
    const configs = await configService.getAll();
    res.json(configs);
  } catch (error) {
    logger.error('Error fetching configs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/configs/:key — Update config value
 */
router.patch('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const adminId = req.adminId;
    const adminRole = req.adminRole || await getAdminRole(adminId);

    await configService.set(key, value, adminId, adminRole);

    // Audit log
    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName: req.adminName || `Admin ${adminId}`,
      actionType: 'config_updated',
      details: `Updated ${key} = ${value}`,
      ipAddress: req.adminIp || req.ip,
    });

    res.json({ success: true, key, value });
  } catch (error) {
    logger.error('Error updating config:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/configs/:key/rollback — Rollback to previous value
 */
router.post('/:key/rollback', async (req, res) => {
  try {
    const { key } = req.params;
    const adminId = req.adminId;
    const adminRole = req.adminRole || await getAdminRole(adminId);

    await configService.rollback(key, adminId, adminRole);

    // Audit log
    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName: req.adminName || `Admin ${adminId}`,
      actionType: 'config_rollback',
      details: `Rolled back ${key}`,
      ipAddress: req.adminIp || req.ip,
    });

    res.json({ success: true, message: `Config ${key} rolled back` });
  } catch (error) {
    logger.error('Error rolling back config:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/configs/:key/history — Get config change history
 */
router.get('/:key/history', async (req, res) => {
  try {
    const { key } = req.params;
    const history = await configService.getHistory(key);
    res.json(history);
  } catch (error) {
    logger.error('Error fetching config history:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Referral Tiers ─────────────────────────────────────────────────

/**
 * GET /api/configs/referral-tiers — List all referral tiers
 */
router.get('/referral-tiers/list', async (req, res) => {
  try {
    const tiers = await configService.getReferralTiers();
    res.json(tiers);
  } catch (error) {
    logger.error('Error fetching referral tiers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/configs/referral-tiers — Add/update a referral tier
 */
router.post('/referral-tiers', async (req, res) => {
  try {
    const adminId = req.adminId;
    const tier = await configService.upsertReferralTier(req.body, adminId);

    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName: req.adminName || `Admin ${adminId}`,
      actionType: 'referral_tier_updated',
      details: `Updated referral tier: ${tier.minDeposit}-${tier.maxDeposit || '∞'} → ${tier.bonusAmount}`,
      ipAddress: req.adminIp || req.ip,
    });

    res.json(tier);
  } catch (error) {
    logger.error('Error updating referral tier:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/configs/referral-tiers/:id — Delete a referral tier
 */
router.delete('/referral-tiers/:id', async (req, res) => {
  try {
    await configService.deleteReferralTier(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting referral tier:', error);
    res.status(400).json({ error: error.message });
  }
});

// ─── Payment Accounts ───────────────────────────────────────────────

/**
 * GET /api/configs/payment-accounts — List all payment accounts
 */
router.get('/payment-accounts/list', async (req, res) => {
  try {
    const accounts = await configService.getPaymentAccounts();
    res.json(accounts);
  } catch (error) {
    logger.error('Error fetching payment accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/configs/payment-accounts — Add/update a payment account
 */
router.post('/payment-accounts', async (req, res) => {
  try {
    const adminId = req.adminId;
    const account = await configService.upsertPaymentAccount(req.body);

    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName: req.adminName || `Admin ${adminId}`,
      actionType: 'payment_account_updated',
      details: `Updated payment account: ${account.provider} ${account.accountNumber}`,
      ipAddress: req.adminIp || req.ip,
    });

    res.json(account);
  } catch (error) {
    logger.error('Error updating payment account:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/configs/payment-accounts/:id — Delete a payment account
 */
router.delete('/payment-accounts/:id', async (req, res) => {
  try {
    await configService.deletePaymentAccount(parseInt(req.params.id));
    res.json({ success: true });
  } catch (error) {
    logger.error('Error deleting payment account:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
