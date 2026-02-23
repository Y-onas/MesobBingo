const express = require('express');
const { Markup } = require('telegraf');
const { jwtAuthMiddleware } = require('../middleware/auth');
const adminService = require('../../services/admin.service');
const configService = require('../../services/config.service');
const { getAdminRole } = require('../../config/admin');
const { EMOJI } = require('../../utils/constants');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * POST /api/broadcast
 * Send broadcast message to users
 */
router.post('/', jwtAuthMiddleware, async (req, res) => {
  try {
    // Check admin role
    const adminRole = req.adminRole || await getAdminRole(req.adminId);
    if (!['super_admin', 'support_admin'].includes(adminRole)) {
      return res.status(403).json({ error: 'Insufficient permissions. Only super_admin and support_admin can broadcast.' });
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
    let keyboard = undefined;
    if (buttonType && buttonType !== 'none') {
      let buttonText, buttonUrl;

      switch (buttonType) {
        case 'play':
          buttonText = `${EMOJI.PLAY} Play`;
          buttonUrl = `https://t.me/${botUsername}?start=play`;
          break;
        case 'deposit':
          buttonText = `${EMOJI.DEPOSIT} Deposit`;
          buttonUrl = `https://t.me/${botUsername}?start=deposit`;
          break;
        case 'balance':
          buttonText = `${EMOJI.BALANCE} Check Balance`;
          buttonUrl = `https://t.me/${botUsername}?start=balance`;
          break;
        case 'invite':
          buttonText = `${EMOJI.INVITE} Invite Friends`;
          buttonUrl = `https://t.me/${botUsername}?start=invite`;
          break;
        default:
          buttonText = 'Open Bot';
          buttonUrl = `https://t.me/${botUsername}`;
      }

      keyboard = Markup.inlineKeyboard([
        [Markup.button.url(buttonText, buttonUrl)]
      ]);
    }

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
    res.status(500).json({ error: error.message || 'Failed to send broadcast' });
  }
});

module.exports = router;
