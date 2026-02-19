const { SOCKET_EVENTS } = require('../utils/constants');
const { JoinGameSchema, SelectBoardSchema, ClaimBingoSchema, LeaveGameSchema, validateMessage } = require('./message-schemas');
const logger = require('../utils/logger');

/**
 * Register all Socket.IO event handlers for a connection
 * @param {import('socket.io').Socket} socket
 * @param {import('../services/bingo-engine').BingoEngine} engine
 * @param {import('./connection-manager').ConnectionManager} connManager
 * @param {import('./rate-limiter').SlidingWindowRateLimiter} rateLimiter
 */
function registerHandlers(socket, engine, connManager, rateLimiter) {
  const telegramId = socket.telegramId;
  const socketId = socket.id;

  // ─── Per-event wrapper with rate limiting ─────────────────────
  const withRateLimit = (handler) => {
    return async (data, callback) => {
      // Global rate limit
      if (!rateLimiter.checkGlobal(socketId)) {
        logger.warn(`Rate limit exceeded for ${socketId}`);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Too many requests' });
        return;
      }

      try {
        await handler(data, callback);
      } catch (error) {
        logger.error(`Handler error for ${socketId}:`, error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Internal error' });
      }
    };
  };

  // ─── GET_ROOMS ─────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.GET_ROOMS, withRateLimit(async () => {
    const rooms = await engine.getActiveRooms();
    socket.emit(SOCKET_EVENTS.ROOMS_LIST, { rooms });
  }));

  // ─── GET_BALANCE ───────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.GET_BALANCE, withRateLimit(async () => {
    const balance = await engine.getUserBalance(telegramId);
    if (balance) {
      socket.emit(SOCKET_EVENTS.BALANCE_UPDATE, balance);
    }
  }));

  // ─── CHECK_ACTIVE_GAME ─────────────────────────────────────────
  socket.on(SOCKET_EVENTS.CHECK_ACTIVE_GAME, withRateLimit(async () => {
    const activeGame = await engine.getUserActiveGame(telegramId);
    if (activeGame) {
      // User is in an active game — auto-rejoin
      socket.join(`game:${activeGame.gameId}`);
      socket.emit(SOCKET_EVENTS.GAME_JOINED, {
        gameId: activeGame.gameId,
        game: activeGame.game,
        boardNumber: activeGame.boardNumber,
        boardContent: activeGame.boardContent,
        reconnect: true,
      });
    }
  }));

  // ─── JOIN_GAME ─────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.JOIN_GAME, withRateLimit(async (data) => {
    logger.info(`JOIN_GAME event received from ${socketId} (user: ${telegramId}), data:`, data);
    
    if (!rateLimiter.checkJoinGame(socketId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Join rate limit exceeded' });
      return;
    }

    const validation = validateMessage(JoinGameSchema, data);
    if (!validation.success) {
      logger.error(`JOIN_GAME validation failed for ${socketId}:`, validation.error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
      return;
    }

    logger.info(`User ${telegramId} attempting to join room ${validation.data.roomId}`);
    const result = await engine.joinGame(socketId, telegramId, validation.data.roomId);

    if (!result.success) {
      logger.error(`JOIN_GAME failed for ${telegramId}:`, result.error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }

    logger.info(`User ${telegramId} successfully joined game ${result.gameId}`);

    // Join Socket.IO room for broadcasts
    socket.join(`game:${result.gameId}`);

    if (result.reconnect) {
      // Reconnection — send current game state with board content
      socket.emit(SOCKET_EVENTS.GAME_JOINED, {
        gameId: result.gameId,
        game: result.game,
        boardNumber: result.boardNumber,
        boardContent: result.boardContent,
        reconnect: true,
      });
    } else {
      socket.emit(SOCKET_EVENTS.GAME_JOINED, {
        gameId: result.gameId,
        game: result.game,
        availableBoards: result.availableBoards,
      });
    }
  }));

  // ─── SELECT_BOARD ──────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.SELECT_BOARD, withRateLimit(async (data) => {
    const validation = validateMessage(SelectBoardSchema, data);
    if (!validation.success) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
      return;
    }

    const result = await engine.selectBoard(
      socketId,
      telegramId,
      validation.data.gameId,
      validation.data.boardNumber
    );

    if (!result.success) {
      socket.emit(SOCKET_EVENTS.BOARD_UNAVAILABLE, { message: result.error });
      return;
    }

    socket.emit(SOCKET_EVENTS.BOARD_ASSIGNED, {
      boardNumber: result.boardNumber,
      boardContent: result.boardContent,
      gameState: result.gameState,
    });

    // Broadcast updated available boards to all players in the game
    socket.to(`game:${validation.data.gameId}`).emit(SOCKET_EVENTS.AVAILABLE_BOARDS, {
      boards: result.availableBoards,
    });

    // Update balance
    const balance = await engine.getUserBalance(telegramId);
    if (balance) {
      socket.emit(SOCKET_EVENTS.BALANCE_UPDATE, balance);
    }
  }));

  // ─── CLAIM_BINGO ───────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.CLAIM_BINGO, withRateLimit(async (data) => {
    if (!rateLimiter.checkBingoClaim(socketId)) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: 'Bingo claim rate limit exceeded' });
      return;
    }

    const validation = validateMessage(ClaimBingoSchema, data);
    if (!validation.success) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
      return;
    }

    const result = await engine.claimBingo(socketId, telegramId, validation.data.gameId);

    socket.emit(SOCKET_EVENTS.BINGO_RESULT, {
      success: result.success,
      error: result.error || null,
      winAmount: result.winAmount || 0,
      pattern: result.pattern || null,
    });

    // Update balance if won
    if (result.success) {
      const balance = await engine.getUserBalance(telegramId);
      if (balance) {
        socket.emit(SOCKET_EVENTS.BALANCE_UPDATE, balance);
      }
    }
  }));

  // ─── LEAVE_GAME ────────────────────────────────────────────────
  socket.on(SOCKET_EVENTS.LEAVE_GAME, withRateLimit(async (data) => {
    const validation = validateMessage(LeaveGameSchema, data);
    if (!validation.success) {
      socket.emit(SOCKET_EVENTS.ERROR, { message: validation.error });
      return;
    }

    await engine.leaveGame(socketId, telegramId, validation.data.gameId);
    socket.leave(`game:${validation.data.gameId}`);

    socket.emit('game_left', { gameId: validation.data.gameId });

    // Update balance (may have been refunded)
    const balance = await engine.getUserBalance(telegramId);
    if (balance) {
      socket.emit(SOCKET_EVENTS.BALANCE_UPDATE, balance);
    }
  }));

  // ─── DISCONNECT ────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    const meta = connManager.getConnection(socketId);
    if (meta && meta.gameId) {
      // Don't refund during active game — player can reconnect
      logger.info(`Player ${telegramId} disconnected from game ${meta.gameId} (reason: ${reason})`);
    }
    
    connManager.removeConnection(socketId);
    rateLimiter.remove(socketId);
    logger.info(`Disconnected: ${socketId} (user: ${telegramId}, reason: ${reason})`);
  });
}

module.exports = { registerHandlers };
