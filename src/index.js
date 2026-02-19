require('dotenv').config();

const http = require('http');
const { createBot } = require('./bot');
const { createApiServer } = require('./api/server');
const { initSocketServer, shutdownSocketServer } = require('./websocket/socket-server');
const { API_PORT } = require('./config/env');
const { pool } = require('./database');
const logger = require('./utils/logger');

/**
 * Main entry point — starts Bot, API, and Socket.IO servers
 */
const main = async () => {
  try {
    logger.info('Starting Mesob Bingo...');
    logger.info('Database: Neon PostgreSQL (Drizzle ORM + pg Pool)');

    // Create and launch bot
    const bot = createBot();

    // Create Express app and HTTP server
    const apiApp = createApiServer();
    const port = API_PORT || 3001;
    const httpServer = http.createServer(apiApp);

    // Attach Socket.IO to the same HTTP server
    const io = initSocketServer(httpServer);

    // Start HTTP server (serves API + Socket.IO on same port)
    httpServer.listen(port, () => {
      logger.info(`🌐 API + Socket.IO server running on http://localhost:${port}`);
    });

    // Launch Telegram bot
    await bot.launch();

    logger.info('🎰 Mesob Bingo is running!');
    logger.info('🔒 Security: Bot protection, Flood detection, Contact verification');
    logger.info('🎮 Socket.IO: Real-time Bingo engine active');
    logger.info('Press Ctrl+C to stop');

    // ─── Graceful Shutdown ────────────────────────────────────────
    let shuttingDown = false;

    const gracefulShutdown = async (signal, exitCode = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.info(`${signal} received — starting graceful shutdown...`);

      // 1. Stop accepting new connections
      await new Promise((resolve) => httpServer.close(resolve));

      // 2. Shut down Socket.IO (finishes active games, disconnects clients)
      await shutdownSocketServer();

      // 3. Stop bot
      bot.stop(signal);

      // 4. Close database pool
      try {
        await pool.end();
        logger.info('Database pool closed');
      } catch (err) {
        logger.error('Error closing database pool:', err);
      }

      logger.info('Graceful shutdown complete');
      process.exit(exitCode);
    };

    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // ─── Crash Prevention ─────────────────────────────────────────
    process.on('uncaughtException', async (err) => {
      logger.error('FATAL: Uncaught exception', err);
      
      try {
        // Alert admin via bot
        const { ADMIN_IDS } = require('./config/env');
        for (const adminId of ADMIN_IDS) {
          try {
            await bot.telegram.sendMessage(adminId, `🚨 CRASH: ${err.message}`);
          } catch (e) { /* ignore send error */ }
        }
      } catch (e) { /* ignore */ }

      await gracefulShutdown('uncaughtException', 1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection:', reason);
      // Don't crash — just log
    });

  } catch (error) {
    logger.error('Failed to start Mesob Bingo:', error);
    process.exit(1);
  }
};

main();
