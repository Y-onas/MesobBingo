const { CONNECTION_LIMITS } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Connection Manager — tracks all active socket connections
 * Enforces per-user, per-IP, and global connection limits
 */
class ConnectionManager {
  constructor() {
    // socketId → metadata
    this.connections = new Map();
    // telegramId → Set<socketId>
    this.userConnections = new Map();
    // ip → Set<socketId>
    this.ipConnections = new Map();
    // gameId → Set<socketId>
    this.gameRooms = new Map();

    this.totalConnections = 0;
  }

  /**
   * Register a new connection
   * @returns {boolean} false if limits exceeded
   */
  addConnection(socketId, telegramId, ip) {
    // Global limit
    if (this.totalConnections >= CONNECTION_LIMITS.MAX_TOTAL) {
      logger.warn(`Global connection limit reached: ${this.totalConnections}`);
      return false;
    }

    // Per-user limit
    const userConns = this.userConnections.get(telegramId) || new Set();
    if (userConns.size >= CONNECTION_LIMITS.MAX_PER_USER) {
      logger.warn(`Per-user limit reached for ${telegramId}: ${userConns.size}`);
      return false;
    }

    // Per-IP limit
    const ipConns = this.ipConnections.get(ip) || new Set();
    if (ipConns.size >= CONNECTION_LIMITS.MAX_PER_IP) {
      logger.warn(`Per-IP limit reached for ${ip}: ${ipConns.size}`);
      return false;
    }

    // Register
    this.connections.set(socketId, {
      telegramId,
      ip,
      gameId: null,
      boardNumber: null,
      joinedAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
    });

    userConns.add(socketId);
    this.userConnections.set(telegramId, userConns);

    ipConns.add(socketId);
    this.ipConnections.set(ip, ipConns);

    this.totalConnections++;
    logger.debug(`Connection added: ${socketId} — total: ${this.totalConnections}`);
    return true;
  }

  /**
   * Remove a connection and clean up all references
   */
  removeConnection(socketId) {
    const meta = this.connections.get(socketId);
    if (!meta) return;

    // Remove from user map
    const userConns = this.userConnections.get(meta.telegramId);
    if (userConns) {
      userConns.delete(socketId);
      if (userConns.size === 0) this.userConnections.delete(meta.telegramId);
    }

    // Remove from IP map
    const ipConns = this.ipConnections.get(meta.ip);
    if (ipConns) {
      ipConns.delete(socketId);
      if (ipConns.size === 0) this.ipConnections.delete(meta.ip);
    }

    // Remove from game room
    if (meta.gameId) {
      const room = this.gameRooms.get(meta.gameId);
      if (room) {
        room.delete(socketId);
        if (room.size === 0) this.gameRooms.delete(meta.gameId);
      }
    }

    this.connections.delete(socketId);
    this.totalConnections--;
    logger.info(`Connection removed: ${socketId} — total: ${this.totalConnections}`);
  }

  /**
   * Get connection metadata
   */
  getConnection(socketId) {
    return this.connections.get(socketId) || null;
  }

  /**
   * Update last activity timestamp
   */
  touch(socketId) {
    const meta = this.connections.get(socketId);
    if (meta) {
      meta.lastActivity = Date.now();
      meta.messageCount++;
    }
  }

  /**
   * Join a game room
   */
  joinGame(socketId, gameId, boardNumber) {
    const meta = this.connections.get(socketId);
    if (!meta) return;

    // Leave current game first
    if (meta.gameId) {
      this.leaveGame(socketId);
    }

    meta.gameId = gameId;
    meta.boardNumber = boardNumber;

    if (!this.gameRooms.has(gameId)) {
      this.gameRooms.set(gameId, new Set());
    }
    this.gameRooms.get(gameId).add(socketId);
  }

  /**
   * Leave current game room
   */
  leaveGame(socketId) {
    const meta = this.connections.get(socketId);
    if (!meta || !meta.gameId) return;

    const room = this.gameRooms.get(meta.gameId);
    if (room) {
      room.delete(socketId);
      if (room.size === 0) this.gameRooms.delete(meta.gameId);
    }

    meta.gameId = null;
    meta.boardNumber = null;
  }

  /**
   * Get all socket IDs in a game
   */
  getGamePlayers(gameId) {
    const room = this.gameRooms.get(gameId);
    return room ? new Set(room) : new Set();
  }

  /**
   * Get player count in a game
   */
  getGamePlayerCount(gameId) {
    const room = this.gameRooms.get(gameId);
    return room ? room.size : 0;
  }

  /**
   * Find socketId by telegramId
   */
  getSocketsByUser(telegramId) {
    const sockets = this.userConnections.get(telegramId);
    return sockets ? new Set(sockets) : new Set();
  }

  /**
   * Get all connections in a game with their metadata
   */
  getGameConnectionDetails(gameId) {
    const room = this.gameRooms.get(gameId);
    if (!room) return [];
    
    const details = [];
    for (const socketId of room) {
      const meta = this.connections.get(socketId);
      if (meta) details.push({ socketId, ...meta });
    }
    return details;
  }

  /**
   * Get stats for monitoring
   */
  getStats() {
    return {
      totalConnections: this.totalConnections,
      uniqueUsers: this.userConnections.size,
      uniqueIPs: this.ipConnections.size,
      activeGames: this.gameRooms.size,
    };
  }

  /**
   * Kill idle connections older than IDLE_TIMEOUT
   */
  killIdleConnections(io) {
    const now = Date.now();
    for (const [socketId, meta] of this.connections) {
      // Idle timeout (2 minutes)
      if (now - meta.lastActivity > CONNECTION_LIMITS.IDLE_TIMEOUT_MS) {
        logger.info(`Killing idle connection: ${socketId}`);
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('error_msg', { message: 'Connection timed out due to inactivity' });
          socket.disconnect(true);
        }
        this.removeConnection(socketId);
      }
      // Max session time (2 hours)
      else if (now - meta.joinedAt > CONNECTION_LIMITS.MAX_SESSION_MS) {
        logger.info(`Max session time reached: ${socketId}`);
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('error_msg', { message: 'Maximum session time reached' });
          socket.disconnect(true);
        }
        this.removeConnection(socketId);
      }
    }
  }
}

module.exports = { ConnectionManager };
