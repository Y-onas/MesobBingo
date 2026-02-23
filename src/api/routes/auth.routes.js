const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../config/env');
const { isAdmin, getAdminRole } = require('../../config/admin');
const logger = require('../../utils/logger');

const router = Router();

// Rate limiter for login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ error: 'Too many login attempts, please try again later' });
  },
});

// POST /api/auth/login — verify admin (DB-based) and issue JWT token
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    const telegramIdNum = Number(telegramId);
    if (!Number.isSafeInteger(telegramIdNum) || telegramIdNum <= 0) {
      return res.status(400).json({ error: 'Telegram ID must be a valid positive number' });
    }

    // Check admin status from database
    const adminIsValid = await isAdmin(telegramIdNum);

    if (!adminIsValid) {
      logger.warn(`Failed admin login attempt: ${telegramId}`);
      return res.status(403).json({
        isAdmin: false,
        error: 'Not authorized',
      });
    }

    // Get role from database
    const role = await getAdminRole(telegramIdNum) || 'support_admin';

    // Generate JWT token
    const token = jwt.sign(
      { 
        telegramId: telegramIdNum,
        role,
        name: `Admin ${telegramId}`
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    logger.info(`Admin login successful: ${telegramId} (role: ${role})`);

    res.json({
      isAdmin: true,
      telegramId: telegramIdNum,
      name: `Admin ${telegramId}`,
      role,
      token,
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (error) {
    logger.error('Admin login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/verify — verify JWT token
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
router.post('/verify-admin', loginLimiter, async (req, res) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ error: 'Telegram ID is required' });
    }

    const telegramIdNum = Number(telegramId);
    if (!Number.isSafeInteger(telegramIdNum) || telegramIdNum <= 0) {
      return res.status(400).json({ error: 'Telegram ID must be a valid positive number' });
    }
    
    const adminIsValid = await isAdmin(telegramIdNum);

    if (adminIsValid) {
      const role = await getAdminRole(telegramIdNum);
      res.json({
        isAdmin: true,
        telegramId: telegramIdNum,
        name: `Admin ${telegramId}`,
        role,
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
