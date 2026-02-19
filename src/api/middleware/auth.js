const { ADMIN_API_KEY } = require('../../config/env');

/**
 * Simple API key authentication middleware
 */
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid API key' });
  }
  
  // Attach admin info from header
  const rawAdminId = req.headers['x-admin-id'];
  // Keep adminId as string to match localStorage values
  req.adminId = rawAdminId || 'admin-001';
  req.adminName = req.headers['x-admin-name'] || 'Unknown Admin';
  req.adminIp = req.ip || req.connection?.remoteAddress || '0.0.0.0';
  
  next();
};

module.exports = { authMiddleware };
