const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { ADMIN_IDS, JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const logger = require('../../utils/logger');

const router = Router();

// POST /api/auth/login — verify admin and issue JWT token
router.post('/login', async (req, res) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    // Check if telegram ID is in ADMIN_IDS
    const adminIds = ADMIN_IDS.map(id => id.toString().trim());
    const isAdmin = adminIds.includes(telegramId.toString().trim());

    if (!isAdmin) {
      logger.warn(`Failed admin login attempt: ${telegramId}`);
      return res.status(403).json({
        isAdmin: false,
        error: 'Not authorized',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        telegramId,
        role: 'admin',
        name: `Admin ${telegramId}`
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info(`Admin login successful: ${telegramId}`);

    res.json({
      isAdmin: true,
      telegramId,
      name: `Admin ${telegramId}`,
      token,
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/verify — verify JWT token (for token refresh/validation)
router.post('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      res.json({
        valid: true,
        telegramId: decoded.telegramId,
        name: decoded.name,
        role: decoded.role
      });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', expired: true });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  } catch (error) {
    logger.error('Token verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Legacy endpoint for backward compatibility (deprecated)
router.post('/verify-admin', async (req, res) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

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
    logger.error('Admin verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

module.exports = router;
