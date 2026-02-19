const { Router } = require('express');
const { ADMIN_IDS } = require('../../config/env');

const router = Router();

// POST /api/auth/verify-admin — verify if telegram ID is an admin
router.post('/verify-admin', async (req, res) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    // Check if telegram ID is in ADMIN_IDS
    const adminIds = ADMIN_IDS.map(id => id.toString().trim());
    const isAdmin = adminIds.includes(telegramId.toString().trim());

    if (isAdmin) {
      res.json({
        isAdmin: true,
        telegramId,
        name: `Admin ${telegramId}`,
      });
    } else {
      res.status(403).json({
        isAdmin: false,
        error: 'Not authorized',
      });
    }
  } catch (error) {
    console.error('Admin verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
