const express = require('express');
const cors = require('cors');
const path = require('path');
const { authMiddleware } = require('./middleware/auth');
const logger = require('../utils/logger');

const statsRoutes = require('./routes/stats.routes');
const depositsRoutes = require('./routes/deposits.routes');
const withdrawalsRoutes = require('./routes/withdrawals.routes');
const usersRoutes = require('./routes/users.routes');
const auditRoutes = require('./routes/audit.routes');
const fraudRoutes = require('./routes/fraud.routes');
const gamesRoutes = require('./routes/games.routes');
const authRoutes = require('./routes/auth.routes');

const createApiServer = () => {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Bypass ngrok/cloudflare browser warnings
  app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    next();
  });

  // Health check with socket stats (no auth)
  app.get('/api/health', (req, res) => {
    let socketStats = {};
    try {
      const { getSocketStats } = require('../websocket/socket-server');
      socketStats = getSocketStats();
    } catch (e) { /* socket server not yet initialized */ }

    res.json({
      status: 'ok',
      service: 'mesob-bingo',
      timestamp: new Date().toISOString(),
      ...socketStats,
    });
  });
  
  // Auth routes (no auth middleware - public)
  app.use('/api/auth', authRoutes);
  
  // Redirect root to game
  app.get('/', (req, res) => {
    res.redirect('/game');
  });

  // Auth-protected admin routes
  app.use('/api/stats', authMiddleware, statsRoutes);
  app.use('/api/deposits', authMiddleware, depositsRoutes);
  app.use('/api/withdrawals', authMiddleware, withdrawalsRoutes);
  app.use('/api/users', authMiddleware, usersRoutes);
  app.use('/api/audit-logs', authMiddleware, auditRoutes);
  app.use('/api/fraud-alerts', authMiddleware, fraudRoutes);
  app.use('/api/game-rooms', authMiddleware, gamesRoutes);

  // Serve static files for the web game
  const gameStaticPath = path.join(__dirname, '../../mesob-bingo-card-main/dist');
  app.use('/game', express.static(gameStaticPath, { index: 'index.html', fallthrough: false }));

  // Serve static files for the admin dashboard
  const dashboardStaticPath = path.join(__dirname, '../../bingo-ops-hub-main/dist');
  app.use('/admin', express.static(dashboardStaticPath, { index: 'index.html' }));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    logger.error('API Error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
};

module.exports = { createApiServer };

