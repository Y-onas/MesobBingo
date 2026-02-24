const express = require('express');
const { jwtAuthMiddleware } = require('../middleware/auth');
const adminService = require('../../services/admin.service');
const configService = require('../../services/config.service');
const { hasPermission } = require('../../config/admin');
const { buildBroadcastKeyboard } = require('../../utils/broadcast-helper');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/broadcast
 * Send broadcast message to users
 */
router.post('/', jwtAuthMiddleware, async (req, res) => {
  try {
    // Check admin permission - support_admin level or above can broadcast
    const canBroadcast = await hasPermission(req.adminId, 'support_admin');
    if (!canBroadcast) {
      return res.status(403).json({ error: 'Insufficient permissions to broadcast.' });
    }

    const { message, audience, buttonType, imageUrl } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!['all', 'depositors'].includes(audience)) {
      return res.status(400).json({ error: 'Invalid audience type' });
    }

    // Get bot username from config
    const botUsername = await configService.get('bot_username');
    if (!botUsername && buttonType) {
      return res.status(400).json({ error: 'Bot username not configured. Please set bot_username in system config.' });
    }

    // Create keyboard if button type is specified
    const keyboard = buildBroadcastKeyboard(buttonType, botUsername);

    // Get bot instance from app
    const bot = req.app.get('bot');
    if (!bot) {
      return res.status(500).json({ error: 'Bot instance not available' });
    }

    // Send broadcast
    const result = await adminService.broadcastMessage(
      bot,
      message,
      audience === 'depositors',
      keyboard,
      imageUrl
    );

    // Log audit
    logger.info(`Broadcast sent by admin ${req.adminName} (${req.adminId}): ${result.success} success, ${result.failed} failed`);

    res.json(result);
  } catch (error) {
    logger.error('Error sending broadcast:', error);
    res.status(500).json({ error: 'Failed to send broadcast' });
  }
});

module.exports = router;
