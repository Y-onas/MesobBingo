const { Server } = require('socket.io');
const { verifyTelegramAuth, devModeAuth } = require('./telegram-auth');
const { ConnectionManager } = require('./connection-manager');
const { SlidingWindowRateLimiter, IPReputationTracker } = require('./rate-limiter');
const { registerHandlers } = require('./message-handler');
const { BingoEngine } = require('../services/bingo-engine');
const { CONNECTION_LIMITS } = require('../utils/constants');
const { MAX_CONNECTIONS_PER_USER, MAX_CONNECTIONS_PER_IP, MAX_TOTAL_CONNECTIONS } = require('../config/env');
const logger = require('../utils/logger');

let io = null;
let connectionManager = null;
let rateLimiter = null;
let ipTracker = null;
let bingoEngine = null;

/**
 * Initialize Socket.IO server attached to an existing HTTP server
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocketServer(httpServer) {
  connectionManager = new ConnectionManager();
  rateLimiter = new SlidingWindowRateLimiter();
  ipTracker = new IPReputationTracker();

  io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: CONNECTION_LIMITS.MAX_PAYLOAD_BYTES,
    pingTimeout: CONNECTION_LIMITS.HEARTBEAT_INTERVAL_MS * 2,
    pingInterval: CONNECTION_LIMITS.HEARTBEAT_INTERVAL_MS,
    connectTimeout: CONNECTION_LIMITS.HANDSHAKE_TIMEOUT_MS,
    transports: ['websocket', 'polling'],
  });

  bingoEngine = new BingoEngine(io, connectionManager);

  // ─── Authentication Middleware ──────────────────────────────────
  io.use((socket, next) => {
    try {
      const ip = socket.handshake.headers['x-forwarded-for'] ||
                 socket.handshake.address ||
                 'unknown';

      // Check IP ban
      if (ipTracker.isBanned(ip)) {
        logger.warn(`Banned IP attempted connection: ${ip}`);
        return next(new Error('Connection refused'));
      }

      // Verify Telegram auth
      const initData = socket.handshake.auth?.initData || socket.handshake.query?.initData;

      let authResult = { valid: false, user: null };

      // Try dev mode first (only works in development)
      if (process.env.NODE_ENV === 'development') {
        authResult = devModeAuth(initData);
      }

      // Try Telegram HMAC verification
      if (!authResult.valid) {
        authResult = verifyTelegramAuth(initData);
      }

      if (!authResult.valid || !authResult.user) {
        logger.warn(`Auth failed from ${ip}`);
        ipTracker.recordViolation(ip, 5);
        return next(new Error('Authentication failed'));
      }

      const telegramId = authResult.user.id;

      // Connection limits check
      if (!connectionManager.addConnection(socket.id, telegramId, ip)) {
        return next(new Error('Connection limit exceeded'));
      }

      // Attach user data to socket
      socket.telegramId = telegramId;
      socket.telegramUser = authResult.user;
      socket.clientIp = ip;

      logger.debug(`Authenticated: ${socket.id}`);
      next();
    } catch (error) {
      logger.error('Auth middleware error:', error);
      next(new Error('Authentication error'));
    }
  });

  // ─── Connection Handler ─────────────────────────────────────────
  io.on('connection', (socket) => {
    logger.debug(`Connected: ${socket.id}`);

    // Per-connection error boundary
    socket.on('error', (err) => {
      logger.error(`Socket error for ${socket.id}:`, err);
      socket.disconnect(true);
    });

    // Register game event handlers
    registerHandlers(socket, bingoEngine, connectionManager, rateLimiter);
  });

  // ─── Periodic Tasks ─────────────────────────────────────────────

  // Kill idle connections every 30 seconds
  const idleCheckInterval = setInterval(() => {
    connectionManager.killIdleConnections(io);
  }, 30000);

  // Memory monitoring every 30 seconds
  const memoryCheckInterval = setInterval(() => {
    const usage = process.memoryUsage();
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    if (heapMB > 400) {
      logger.warn(`HIGH MEMORY: heap=${heapMB}MB, rss=${rssMB}MB`);
      if (global.gc) global.gc();
    }

    // Log stats periodically
    const stats = connectionManager.getStats();
    logger.info(`Stats: conns=${stats.totalConnections}, users=${stats.uniqueUsers}, games=${stats.activeGames}, heap=${heapMB}MB`);
  }, 30000);

  // Store intervals for cleanup
  io._customIntervals = [idleCheckInterval, memoryCheckInterval];

  logger.info('Socket.IO server initialized');
  return io;
}

/**
 * Get server stats for health endpoint
 */
function getSocketStats() {
  if (!connectionManager) return { connections: 0 };
  return {
    ...connectionManager.getStats(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
    },
    uptime: Math.round(process.uptime()),
  };
}

/**
 * Graceful shutdown
 */
async function shutdownSocketServer() {
  logger.info('Shutting down Socket.IO server...');

  if (io && io._customIntervals) {
    io._customIntervals.forEach(clearInterval);
  }

  if (bingoEngine) {
    await bingoEngine.finishAllGames();
    bingoEngine.destroy();
  }

  if (rateLimiter) rateLimiter.destroy();
  if (ipTracker) ipTracker.destroy();

  if (io) {
    // Disconnect all clients
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      socket.emit('error_msg', { message: 'Server shutting down' });
      socket.disconnect(true);
    }
    io.close();
  }

  logger.info('Socket.IO server shut down');
}

module.exports = { initSocketServer, getSocketStats, shutdownSocketServer };
