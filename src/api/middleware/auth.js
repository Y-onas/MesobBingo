const jwt = require('jsonwebtoken');
const { ADMIN_API_KEY, JWT_SECRET } = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * JWT-based authentication middleware (preferred)
 * Verifies JWT token from Authorization header
 */
const jwtAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided' });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Attach admin info from token
    req.adminId = decoded.telegramId;
    req.adminName = decoded.name || `Admin ${decoded.telegramId}`;
    req.adminRole = decoded.role;
    req.adminIp = req.ip || req.connection?.remoteAddress || '0.0.0.0';
    
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorized — token expired', expired: true });
    }
    logger.warn(`Invalid JWT token attempt from ${req.ip}`);
    return res.status(401).json({ error: 'Unauthorized — invalid token' });
  }
};

/**
 * Legacy API key authentication middleware (deprecated, for backward compatibility)
 * Will be removed in future versions
 */
const apiKeyAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid API key' });
  }
  
  // Attach admin info from header
  const rawAdminId = req.headers['x-admin-id'];
  req.adminId = rawAdminId || 'admin-001';
  req.adminName = req.headers['x-admin-name'] || 'Unknown Admin';
  req.adminIp = req.ip || req.connection?.remoteAddress || '0.0.0.0';
  
  logger.warn(`Legacy API key auth used by ${req.adminId} - please migrate to JWT`);
  next();
};

/**
 * Combined auth middleware - tries JWT first, falls back to API key
 * This allows gradual migration from API key to JWT
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  // Prefer JWT if Authorization header is present
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return jwtAuthMiddleware(req, res, next);
  }
  
  // Fall back to API key for backward compatibility
  if (apiKey) {
    return apiKeyAuthMiddleware(req, res, next);
  }

  // No valid authentication provided
  return res.status(401).json({ error: 'Unauthorized — no valid authentication provided' });
};

module.exports = { authMiddleware, jwtAuthMiddleware, apiKeyAuthMiddleware };
