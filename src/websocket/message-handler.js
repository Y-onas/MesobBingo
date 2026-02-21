const { SOCKET_EVENTS, DISCONNECT_GRACE_PERIODS } = require('../utils/constants');
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
      // Update last activity timestamp
      connManager.touch(socketId);
      
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
      // Check if game already ended with a winner
      if (activeGame.game.status === 'completed') {
        // Get winner information from the game
        const winnerInfo = await engine.getGameWinner(activeGame.gameId);
        
        if (winnerInfo) {
          socket.emit(SOCKET_EVENTS.ERROR, { 
            message: `Game has already ended. Winner: ${winnerInfo.winnerName} won ${winnerInfo.winAmount} Birr` 
          });
        } else {
          socket.emit(SOCKET_EVENTS.ERROR, { 
            message: 'Game has already ended. A winner was declared.' 
          });
        }
        return;
      }
      
      // User is in an active game — auto-rejoin
      socket.join(`game:${activeGame.gameId}`);
      
      // If game was paused due to all players disconnecting, resume it
      const connectedPlayers = connManager.getGamePlayerCount(activeGame.gameId);
      if (connectedPlayers === 1) { // This is the first player to reconnect
        engine.resumeGame(activeGame.gameId);
      }
      
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
    logger.debug(`JOIN_GAME event received from ${socketId}`);
    
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

    logger.debug(`Attempting to join room ${validation.data.roomId}`);
    const result = await engine.joinGame(socketId, telegramId, validation.data.roomId);

    if (!result.success) {
      logger.error(`JOIN_GAME failed:`, result.error);
      socket.emit(SOCKET_EVENTS.ERROR, { message: result.error });
      return;
    }

    logger.debug(`Successfully joined game ${result.gameId}`);

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

    // Extract markedNumbers if provided
    const { gameId, markedNumbers } = validation.data;

    // Additional validation for markedNumbers if provided
    if (markedNumbers !== undefined && markedNumbers !== null) {
      if (!Array.isArray(markedNumbers)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid marked numbers format' });
        return;
      }
      if (!markedNumbers.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 75)) {
        socket.emit(SOCKET_EVENTS.ERROR, { message: 'Invalid marked numbers values' });
        return;
      }
    }

    const result = await engine.claimBingo(socketId, telegramId, gameId, markedNumbers || null);

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
  socket.on('disconnect', async (reason) => {
    const meta = connManager.getConnection(socketId);
    if (meta && meta.gameId) {
      logger.info(`Player ${telegramId} disconnected from game ${meta.gameId} (reason: ${reason}). Player remains in game and can reconnect.`);
      
      // Player stays in the game - they can reconnect by reloading
      
      // Check if ALL players are now disconnected (ONLY pause if ALL disconnect)
      setTimeout(async () => {
        const game = await engine.getGameState(meta.gameId);
        if (!game) return; // Game already ended normally
        
        const connectedPlayers = connManager.getGamePlayerCount(meta.gameId);
        
        // ONLY pause if:
        // 1. NO players are connected (ALL disconnected)
        // 2. Game is still playing (not completed)
        if (connectedPlayers === 0 && game.status === 'playing') {
          logger.warn(`All players disconnected from game ${meta.gameId}. PAUSING game for ${DISCONNECT_GRACE_PERIODS.GAME_PAUSE_TIMEOUT_MS / 1000}s grace period...`);
          
          // PAUSE the game - stop calling numbers
          engine.pauseGame(meta.gameId);
          
          // Store timeout so it can be cancelled if players reconnect
          const pauseTimeout = setTimeout(async () => {
            const finalCheck = connManager.getGamePlayerCount(meta.gameId);
            const gameStillExists = await engine.getGameState(meta.gameId);
            
            // If still no players after 40 seconds, house wins
            if (finalCheck === 0 && gameStillExists && gameStillExists.status === 'playing') {
              logger.info(`No players reconnected to game ${meta.gameId} after ${DISCONNECT_GRACE_PERIODS.GAME_PAUSE_TIMEOUT_MS / 1000}s. House wins - no refunds.`);
              await engine.endGameHouseWins(meta.gameId);
            } else if (finalCheck > 0) {
              logger.info(`Player(s) reconnected to game ${meta.gameId} during timeout check.`);
              // Resume is handled by CHECK_ACTIVE_GAME handler
            }
          }, DISCONNECT_GRACE_PERIODS.GAME_PAUSE_TIMEOUT_MS);
          
          // Store timeout in engine so it can be cancelled
          engine.pauseTimeouts.set(meta.gameId, pauseTimeout);
        } else if (connectedPlayers > 0) {
          logger.debug(`Game ${meta.gameId} still has ${connectedPlayers} connected player(s). Game continues normally.`);
        }
      }, 100); // Small delay to ensure connection state is updated
    }
    
    // Only remove socket connection, NOT the player from the game
    connManager.removeConnection(socketId);
    rateLimiter.remove(socketId);
    logger.debug(`Socket disconnected: ${socketId} (reason: ${reason})`);
  });
}

module.exports = { registerHandlers };
