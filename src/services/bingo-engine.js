const crypto = require('crypto');
const { db, pool } = require('../database');
const { games, boards, gamePlayers, calledNumbers, gameRooms, users } = require('../database/schema');
const { eq, sql, and, desc, isNull } = require('drizzle-orm');
const { generateBingoBoard, hashBoard, validateBingoWin, getBingoLetter } = require('../utils/helpers');
const { GAME_STATES, BINGO_LETTERS } = require('../utils/constants');
const { NUMBER_CALL_INTERVAL_MS, COUNTDOWN_SECONDS, BOARDS_PER_GAME } = require('../config/env');
const logger = require('../utils/logger');
const { getWinPercentage } = require('./win-percentage.service');

/**
 * BingoEngine — Server-authoritative game engine
 * Manages the full game lifecycle: create → lobby → countdown → playing → completed
 */
class BingoEngine {
  constructor(io, connectionManager) {
    this.io = io;
    this.connectionManager = connectionManager;

    // In-memory game state for fast access (DB is source of truth)
    this.activeGames = new Map(); // gameId → GameState
    this.callTimers = new Map();  // gameId → timer
    this.countdownTimers = new Map(); // gameId → timer
    this.pauseTimeouts = new Map(); // gameId → timeout (for cancelling)
    this.endingGames = new Set(); // gameId set (prevent duplicate endings)

    // Metrics tracking
    this.metrics = {
      gamesCreated: 0,
      gamesCompleted: 0,
      gamesCancelled: 0,
      gamesPaused: 0,
      gamesResumed: 0,
      houseWins: 0,
      playerWins: 0,
      totalBetsCollected: 0,
      totalPayouts: 0
    };

    // Cleanup finished games every 5 minutes
    this._cleanupInterval = setInterval(() => this.cleanupFinished(), 300000);
  }

  // ═══════════════════════════════════════════════════════════════════
  // GAME LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get all active game rooms with live player counts
   */
  async getActiveRooms() {
    try {
      const rooms = await db.select().from(gameRooms).orderBy(desc(gameRooms.createdAt));
      return rooms.map(room => {
        const activeGame = this._findActiveGameForRoom(room.id);
        return {
          id: room.id,
          name: room.name,
          entryFee: Number(room.entryFee),
          minPlayers: room.minPlayers,
          maxPlayers: room.maxPlayers,
          currentPlayers: activeGame ? activeGame.playerCount : 0,
          countdownTime: room.countdownTime,
          winningPercentage: room.winningPercentage,
          totalPot: activeGame ? activeGame.prizePool : 0,
          status: activeGame ? activeGame.status : 'waiting',
          gameId: activeGame ? activeGame.id : null,
          startsIn: activeGame && activeGame.status === 'countdown' ? activeGame.countdownRemaining : null,
        };
      });
    } catch (error) {
      logger.error('Error getting active rooms:', error);
      return [];
    }
  }

  /**
   * Find the currently active game for a room
   */
  _findActiveGameForRoom(roomId) {
    for (const [, game] of this.activeGames) {
      if (game.roomId === roomId && 
          [GAME_STATES.WAITING, GAME_STATES.LOBBY, GAME_STATES.COUNTDOWN, GAME_STATES.PLAYING].includes(game.status)) {
        return game;
      }
    }
    return null;
  }

  /**
   * Join a game room — creates game if none exists, or joins existing
   */
  async joinGame(socketId, telegramId, roomId) {
    try {
      // Get room config
      const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId)).limit(1);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Check user balance
      const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const totalBalance = Number(user.mainWallet) + Number(user.playWallet);
      if (totalBalance < Number(room.entryFee)) {
        return { success: false, error: 'Insufficient balance' };
      }

      // Find or create active game for this room
      let activeGame = this._findActiveGameForRoom(roomId);

      if (!activeGame) {
        activeGame = await this._createGame(room);
      }

      // Check if game is joinable
      if (![GAME_STATES.WAITING, GAME_STATES.LOBBY, GAME_STATES.COUNTDOWN].includes(activeGame.status)) {
        return { success: false, error: 'Game already in progress' };
      }

      // Check if already in this game
      if (activeGame.players && activeGame.players.has(telegramId)) {
        // Reconnect — return existing game state with board content
        const boardNumber = activeGame.playerBoards ? activeGame.playerBoards.get(telegramId) : null;
        const boardContent = (boardNumber && activeGame.boards) ? activeGame.boards.get(boardNumber) : null;
        
        return {
          success: true,
          reconnect: true,
          gameId: activeGame.id,
          game: this._getGameState(activeGame),
          boardNumber,
          boardContent,
        };
      }

      // Check max players
      if (activeGame.playerCount >= room.maxPlayers) {
        return { success: false, error: 'Room is full' };
      }

      return {
        success: true,
        gameId: activeGame.id,
        game: this._getGameState(activeGame),
        availableBoards: this._getAvailableBoards(activeGame),
      };
    } catch (error) {
      logger.error('Error joining game:', error);
      return { success: false, error: 'Failed to join game' };
    }
  }

  /**
   * Create a new game for a room
   */
  async _createGame(room) {
    // Insert game into DB
    const [dbGame] = await db.insert(games).values({
      roomId: room.id,
      status: GAME_STATES.LOBBY,
      winPattern: 'any',
      prizePool: '0',
      commission: '0',
    }).returning();

    // Generate 200 boards server-side
    const boardsData = [];
    for (let i = 1; i <= BOARDS_PER_GAME; i++) {
      const board = generateBingoBoard();
      const hash = hashBoard(board);
      boardsData.push({
        gameId: dbGame.id,
        boardNumber: i,
        content: JSON.stringify(board),
        boardHash: hash,
      });
    }

    // Insert boards in batches of 50
    for (let i = 0; i < boardsData.length; i += 50) {
      await db.insert(boards).values(boardsData.slice(i, i + 50));
    }

    // In-memory state
    const gameState = {
      id: dbGame.id,
      roomId: room.id,
      roomName: room.name,
      entryFee: Number(room.entryFee),
      minPlayers: room.minPlayers,
      maxPlayers: room.maxPlayers,
      countdownTime: room.countdownTime,
      winningPercentage: room.winningPercentage,
      winnerTimeWindowMs: room.winnerTimeWindowMs ?? 100, // Time window for multiple winners (100ms)
      status: GAME_STATES.LOBBY,
      players: new Set(),       // Set<telegramId>
      playerBoards: new Map(),  // telegramId → boardNumber
      boards: new Map(),        // boardNumber → board content (5x5 array)
      falseClaimCount: new Map(), // NEW: telegramId → count
      pendingWinners: [],       // NEW: [{telegramId, boardNumber, timestamp}]
      firstWinnerTimestamp: null, // NEW: timestamp of first winner
      winnerWindowClosed: false, // NEW: flag to prevent late claims
      calledNumbers: [],        // ordered list of called numbers
      calledSet: new Set(),     // for quick lookup
      prizePool: 0,
      playerCount: 0,
      winnerId: null,
      countdownRemaining: null,
      createdAt: Date.now(),
    };

    // Store board contents in memory for quick access
    for (const boardData of boardsData) {
      gameState.boards.set(boardData.boardNumber, JSON.parse(boardData.content));
    }

    this.activeGames.set(dbGame.id, gameState);
    this.metrics.gamesCreated++;
    logger.logGameEvent('game_created', dbGame.id, {
      roomId: room.id,
      roomName: room.name,
      entryFee: room.entryFee
    });

    return gameState;
  }

  /**
   * Select a board for a player (concurrency-safe)
   */
  async selectBoard(socketId, telegramId, gameId, boardNumber) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (![GAME_STATES.LOBBY, GAME_STATES.COUNTDOWN].includes(game.status)) {
      return { success: false, error: 'Cannot select board now' };
    }
    if (game.players.has(telegramId)) {
      return { success: false, error: 'Already in game' };
    }

    // Use pg.Pool for transaction with row locking
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the specific board row
      const { rows: [board] } = await client.query(
        'SELECT * FROM boards WHERE game_id = $1 AND board_number = $2 FOR UPDATE',
        [gameId, boardNumber]
      );

      if (!board) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Board not found' };
      }

      if (board.assigned_to) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Board already taken' };
      }

      // Deduct entry fee from user (prefer play wallet, then main wallet)
      const { rows: [user] } = await client.query(
        'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
        [telegramId]
      );

      const playBalance = Number(user.play_wallet);
      const mainBalance = Number(user.main_wallet);

      if (playBalance >= game.entryFee) {
        await client.query(
          'UPDATE users SET play_wallet = play_wallet - $1 WHERE telegram_id = $2',
          [game.entryFee, telegramId]
        );
      } else if (mainBalance >= game.entryFee) {
        await client.query(
          'UPDATE users SET main_wallet = main_wallet - $1 WHERE telegram_id = $2',
          [game.entryFee, telegramId]
        );
      } else {
        await client.query('ROLLBACK');
        return { success: false, error: 'Insufficient balance' };
      }

      // Assign board
      await client.query(
        'UPDATE boards SET assigned_to = $1, assigned_at = NOW() WHERE game_id = $2 AND board_number = $3',
        [telegramId, gameId, boardNumber]
      );

      // Insert game_player record
      await client.query(
        'INSERT INTO game_players (game_id, telegram_id, board_number, bet_amount) VALUES ($1, $2, $3, $4)',
        [gameId, telegramId, boardNumber, game.entryFee]
      );

      // Update game prize pool
      const newPrizePool = game.prizePool + game.entryFee;
      const commission = newPrizePool * ((100 - game.winningPercentage) / 100);
      const expectedPayout = newPrizePool - commission;

      await client.query(
        'UPDATE games SET player_count = player_count + 1, prize_pool = $1, commission = $2 WHERE id = $3',
        [newPrizePool.toString(), commission.toString(), gameId]
      );

      await client.query('COMMIT');

      // Update in-memory state
      game.players.add(telegramId);
      game.playerBoards.set(telegramId, boardNumber);
      game.playerCount++;
      game.prizePool = newPrizePool;

      // Join socket.io room
      this.connectionManager.joinGame(socketId, gameId, boardNumber);

      // Get board content for the player
      const boardContent = JSON.parse(board.content);

      // Notify game room
      this._broadcastToGame(gameId, 'player_joined', {
        playerCount: game.playerCount,
        totalPot: Math.floor(newPrizePool * (game.winningPercentage / 100)),
      });

      // Start countdown when min players reached
      if (game.playerCount >= game.minPlayers && game.status === GAME_STATES.LOBBY) {
        this._startCountdown(gameId);
      }

      logger.debug(`Player selected board ${boardNumber} in game ${gameId}`);

      return {
        success: true,
        boardNumber,
        boardContent,
        gameState: this._getGameState(game),
        availableBoards: this._getAvailableBoards(game),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error selecting board:', error);
      return { success: false, error: 'Failed to select board' };
    } finally {
      client.release();
    }
  }

  /**
   * Start countdown for a game
   */
  async _startCountdown(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game || game.status !== GAME_STATES.LOBBY) return;

    // Calculate dynamic win percentage based on current player count
    try {
      const dynamicWinPercentage = await getWinPercentage(game.roomId, game.playerCount);
      game.winningPercentage = dynamicWinPercentage;
      
      // Recalculate commission with the new dynamic percentage
      const commission = game.prizePool * ((100 - game.winningPercentage) / 100);
      const expectedPayout = game.prizePool - commission;
      
      // Update database with new commission
      await db.update(games)
        .set({ 
          commission: commission.toString(),
          expectedPayout: expectedPayout.toString()
        })
        .where(eq(games.id, gameId));
      
      logger.info(`Game ${gameId} using dynamic win percentage: ${dynamicWinPercentage}% (${game.playerCount} players), commission: ${commission.toFixed(2)}`);
    } catch (error) {
      logger.error(`Error calculating dynamic win percentage for game ${gameId}:`, error);
      // Keep the static percentage if calculation fails
    }

    game.status = GAME_STATES.COUNTDOWN;
    game.countdownRemaining = game.countdownTime;

    // Update DB
    db.update(games)
      .set({ status: GAME_STATES.COUNTDOWN })
      .where(eq(games.id, gameId))
      .catch(err => logger.error('Error updating game status:', err));

    this._broadcastToGame(gameId, 'countdown_start', {
      seconds: game.countdownTime,
    });

    // Tick every second
    const timer = setInterval(() => {
      game.countdownRemaining--;

      if (game.countdownRemaining <= 0) {
        clearInterval(timer);
        this.countdownTimers.delete(gameId);
        this._startGame(gameId);
      } else {
        this._broadcastToGame(gameId, 'countdown_tick', {
          seconds: game.countdownRemaining,
        });
      }
    }, 1000);

    this.countdownTimers.set(gameId, timer);
  }

  /**
   * Start the game — begin calling numbers
   */
  async _startGame(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    if (game.playerCount < game.minPlayers) {
      // Not enough players — cancel and refund
      await this._cancelGame(gameId, 'Not enough players');
      return;
    }

    game.status = GAME_STATES.PLAYING;

    await db.update(games)
      .set({ status: GAME_STATES.PLAYING, startedAt: new Date() })
      .where(eq(games.id, gameId));

    this._broadcastToGame(gameId, 'game_started', {
      playerCount: game.playerCount,
      totalPot: Math.floor(game.prizePool * (game.winningPercentage / 100)),
    });

    logger.info(`Game ${gameId} started with ${game.playerCount} players`);

    // Start calling numbers
    this._scheduleNextCall(gameId);
  }

  /**
   * Schedule the next number call
   */
  _scheduleNextCall(gameId) {
    const timer = setTimeout(() => {
      this._callNumber(gameId);
    }, NUMBER_CALL_INTERVAL_MS);

    this.callTimers.set(gameId, timer);
  }

  /**
   * Call a random number (1-75, no duplicates)
   */
  async _callNumber(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game || game.status !== GAME_STATES.PLAYING) return;

    // All numbers called — no winner
    if (game.calledSet.size >= 75) {
      await this._endGameNoWinner(gameId);
      return;
    }

    // Generate next number (crypto-safe, no duplicates)
    let number;
    do {
      number = crypto.randomInt(1, 76);
    } while (game.calledSet.has(number));

    // Update in-memory FIRST (before DB)
    game.calledNumbers.push(number);
    game.calledSet.add(number);

    try {
      // Persist to DB with retry logic
      await this._retryDbOperation(async () => {
        await db.insert(calledNumbers).values({
          gameId,
          number,
          callOrder: game.calledNumbers.length,
        });
      }, 'persisting called number');

      // Update total calls in game with retry logic
      await this._retryDbOperation(async () => {
        await db.update(games)
          .set({ totalCalls: game.calledNumbers.length })
          .where(eq(games.id, gameId));
      }, 'updating total calls');

    } catch (dbError) {
      // CRITICAL: DB write failed after retries - rollback in-memory state
      logger.error(`CRITICAL: Failed to persist number ${number} for game ${gameId} after retries. Rolling back in-memory state.`, dbError);
      
      // Rollback in-memory changes
      game.calledNumbers.pop();
      game.calledSet.delete(number);
      
      // Pause the game to prevent further inconsistency
      logger.error(`Pausing game ${gameId} due to database write failure`);
      game.paused = true;
      game.pausedAt = Date.now();
      
      // Notify players
      this._broadcastToGame(gameId, 'game_paused', {
        reason: 'Database error - game paused for safety',
        message: 'The game has been paused due to a technical issue. Please wait while we resolve this.'
      });
      
      // Stop the game loop
      this._stopTimers(gameId);
      
      return; // Don't broadcast the number or schedule next call
    }

    const letter = getBingoLetter(number);

    // Broadcast to room — single JSON.stringify
    this._broadcastToGame(gameId, 'number_called', {
      letter,
      number,
      callOrder: game.calledNumbers.length,
      calledNumbers: game.calledNumbers,
    });

    logger.info(`Game ${gameId}: Called ${letter}${number} (#${game.calledNumbers.length})`);

    // Schedule next call
    this._scheduleNextCall(gameId);
  }

  /**
   * Handle BINGO claim — server validates everything
   */
  async claimBingo(socketId, telegramId, gameId, markedNumbers = null) {
    const game = this.activeGames.get(gameId);
    if (!game) return { success: false, error: 'Game not found' };
    if (game.status !== GAME_STATES.PLAYING) return { success: false, error: 'Game not in progress' };
    if (game.winnerWindowClosed) return { success: false, error: 'Game already won' };
    if (!game.players.has(telegramId)) return { success: false, error: 'Not in this game' };

    const boardNumber = game.playerBoards.get(telegramId);
    if (!boardNumber) return { success: false, error: 'No board assigned' };

    // Validate markedNumbers input
    if (markedNumbers !== null) {
      if (!Array.isArray(markedNumbers)) {
        return { success: false, error: 'Invalid marked numbers format' };
      }
      if (markedNumbers.length > 75) {
        return { success: false, error: 'Too many marked numbers' };
      }
      if (!markedNumbers.every(n => typeof n === 'number' && n >= 1 && n <= 75)) {
        return { success: false, error: 'Invalid marked numbers values' };
      }
    }

    // Use PostgreSQL transaction (NO row locking for concurrent claims)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get board from DB (never trust memory for validation)
      const { rows: [dbBoard] } = await client.query(
        'SELECT * FROM boards WHERE game_id = $1 AND board_number = $2',
        [gameId, boardNumber]
      );

      if (!dbBoard) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Board not found' };
      }

      // Get called numbers from DB
      const { rows: dbCalled } = await client.query(
        'SELECT number FROM called_numbers WHERE game_id = $1 ORDER BY call_order',
        [gameId]
      );

      const calledNums = dbCalled.map(r => r.number);
      const boardContent = JSON.parse(dbBoard.content);

      // Determine which numbers to validate against
      let numbersToValidate;
      
      if (markedNumbers !== null && markedNumbers.length > 0) {
        // MANUAL MARKING MODE: Validate against marked numbers only
        const calledSet = new Set(calledNums);
        
        // Anti-cheat: Verify all marked numbers were actually called
        for (const num of markedNumbers) {
          if (!calledSet.has(num)) {
            logger.warn(`Cheating attempt by ${telegramId} in game ${gameId}: marked uncalled number ${num}`);
            const falseClaimResult = await this._handleFalseClaim(client, game, telegramId, gameId);
            await client.query('COMMIT');
            return falseClaimResult;
          }
        }
        
        numbersToValidate = markedNumbers;
        logger.debug(`Validating BINGO claim for ${telegramId} using ${markedNumbers.length} marked numbers`);
      } else {
        // FALLBACK MODE: Use all called numbers (backward compatibility)
        numbersToValidate = calledNums;
        logger.debug(`Validating BINGO claim for ${telegramId} using all ${calledNums.length} called numbers (fallback mode)`);
      }

      // Server-side win validation
      const result = validateBingoWin(boardContent, numbersToValidate, 'any');

      if (!result.isWin) {
        // INVALID CLAIM - Handle false claim
        const falseClaimResult = await this._handleFalseClaim(client, game, telegramId, gameId);
        await client.query('COMMIT');
        return falseClaimResult;
      }

      // VALID WIN - Check timing for multiple winners
      const claimTimestamp = Date.now();

      if (!game.firstWinnerTimestamp) {
        // FIRST WINNER - Start time window
        game.firstWinnerTimestamp = claimTimestamp;
        game.pendingWinners.push({
          telegramId,
          boardNumber,
          timestamp: claimTimestamp
        });

        await client.query('COMMIT');

        logger.debug(`First winner claim in game ${gameId} - starting ${game.winnerTimeWindowMs}ms window`);

        // Schedule window closure
        setTimeout(() => {
          this._closeWinnerWindow(gameId);
        }, game.winnerTimeWindowMs);

        return {
          success: true,
          status: 'pending',
          message: 'Valid BINGO! Checking for other winners...'
        };
      } else {
        // SUBSEQUENT WINNER - Check if within window
        const timeSinceFirst = claimTimestamp - game.firstWinnerTimestamp;

        if (timeSinceFirst <= game.winnerTimeWindowMs) {
          // Within window - add to pending winners
          game.pendingWinners.push({
            telegramId,
            boardNumber,
            timestamp: claimTimestamp
          });

          await client.query('COMMIT');

          logger.debug(`Additional winner in game ${gameId} (${timeSinceFirst}ms after first)`);

          return {
            success: true,
            status: 'pending',
            message: 'Valid BINGO! Checking for other winners...'
          };
        } else {
          // Window closed
          await client.query('ROLLBACK');
          return { success: false, error: 'Game already won' };
        }
      }
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error processing bingo claim:', error);
      return { success: false, error: 'Validation failed' };
    } finally {
      client.release();
    }
  }
  /**
   * Helper: Emit event to a specific player
   */
  _emitToPlayer(telegramId, event, data) {
    const sockets = this.connectionManager.getSocketsByUser(telegramId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit(event, data);
        }
      });
    }
  }

  /**
   * Helper: Handle false claim - remove player immediately
   */
  async _handleFalseClaim(client, game, telegramId, gameId) {
    const currentCount = game.falseClaimCount.get(telegramId) || 0;
    const newCount = currentCount + 1;
    game.falseClaimCount.set(telegramId, newCount);

    // Update database
    await client.query(
      'UPDATE game_players SET false_claim_count = $1 WHERE game_id = $2 AND telegram_id = $3',
      [newCount, gameId, telegramId]
    );

    // Immediate removal on first false claim
    logger.warn(`False BINGO claim by ${telegramId} in game ${gameId} - REMOVING PLAYER`);

    await this._removePlayerForFalseClaims(client, game, telegramId, gameId);

    return {
      success: false,
      error: 'Invalid BINGO claim. You have been removed from the game. Entry fee is not refunded.'
    };
  }

  /**
   * Helper: Remove player for false claims
   */
  async _removePlayerForFalseClaims(client, game, telegramId, gameId) {
    // Remove from in-memory game state
    game.players.delete(telegramId);
    game.playerBoards.delete(telegramId);
    game.playerCount = game.players.size;

    // Update database
    await client.query(
      'UPDATE game_players SET removed_for_false_claims = true WHERE game_id = $1 AND telegram_id = $2',
      [gameId, telegramId]
    );

    // Get player name (using transaction client for consistency)
    const { rows: [player] } = await client.query(
      'SELECT first_name, username FROM users WHERE telegram_id = $1 LIMIT 1',
      [telegramId]
    );
    const playerName = player ? (player.first_name || player.username || `User ${telegramId}`) : `User ${telegramId}`;

    // Redirect removed player to lobby
    this._emitToPlayer(telegramId, 'force_leave_game', {
      reason: 'removed_for_false_claims',
      message: 'You have been removed from the game for an invalid BINGO claim. Entry fee is not refunded.'
    });

    // Ensure server-side removal from the game room
    const sockets = this.connectionManager.getSocketsByUser(telegramId);
    if (sockets && sockets.size > 0) {
      sockets.forEach(socketId => this.connectionManager.leaveGame(socketId));
    }

    // Notify all OTHER players
    this._broadcastToGame(gameId, 'player_removed', {
      telegramId,
      playerName,
      reason: 'false_claim'
    });

    logger.debug(`Player removed from game ${gameId} for false claims. ${game.playerCount} players remaining.`);

    // Check remaining players
    if (game.playerCount === 0 && game.status === GAME_STATES.PLAYING) {
      // No players left - end game with no winner
      logger.info(`No players remaining in game ${gameId}. Ending game.`);
      await this._endGameNoWinner(gameId);
    } else if (game.playerCount === 1 && game.status === GAME_STATES.PLAYING) {
      // Only 1 player remains - they win automatically
      const remainingPlayerId = Array.from(game.players)[0];
      const remainingBoardNumber = game.playerBoards.get(remainingPlayerId);
      
      logger.info(`Only 1 player remains in game ${gameId}. Player ${remainingPlayerId} wins automatically.`);
      
      // Award win to remaining player
      await this._awardWinToRemainingPlayer(client, game, remainingPlayerId, remainingBoardNumber, gameId);
    }
  }

  /**
   * Helper: Award win to the last remaining player
   */
  async _awardWinToRemainingPlayer(client, game, telegramId, boardNumber, gameId) {
    try {
      // Get game from DB
      const { rows: [dbGame] } = await client.query(
        'SELECT * FROM games WHERE id = $1',
        [gameId]
      );

      if (!dbGame) return;

      const prizePool = Number(dbGame.prize_pool);
      const winAmount = Math.floor(prizePool * (game.winningPercentage / 100));

      // Update winner balance
      await client.query(
        'UPDATE users SET main_wallet = main_wallet + $1, games_won = games_won + 1 WHERE telegram_id = $2',
        [winAmount, telegramId]
      );

      // Update all players games_played
      const playerIds = Array.from(game.players);
      if (playerIds.length > 0) {
        await client.query(
          'UPDATE users SET games_played = games_played + 1 WHERE telegram_id = ANY($1)',
          [playerIds]
        );
      }

      // Mark game as completed
      await client.query(
        'UPDATE games SET status = $1, winner_id = $2, winner_board_number = $3, finished_at = NOW() WHERE id = $4',
        [GAME_STATES.COMPLETED, telegramId, boardNumber, gameId]
      );

      // Update in-memory
      game.status = GAME_STATES.COMPLETED;
      game.winnerId = telegramId;

      // Stop number calling
      this._stopTimers(gameId);

      // Get winner display name (using transaction client)
      const { rows: [winner] } = await client.query(
        'SELECT first_name, username FROM users WHERE telegram_id = $1 LIMIT 1',
        [telegramId]
      );
      const winnerName = winner ? (winner.first_name || winner.username || `User ${telegramId}`) : `User ${telegramId}`;

      // Broadcast winner to all players
      this._broadcastToGame(gameId, 'game_won', {
        winnerId: telegramId,
        winnerName,
        boardNumber,
        winAmount,
        pattern: 'last_player_standing',
        winningLine: null,
        message: 'Winner by default - last player remaining!'
      });

      logger.debug(`Game ${gameId} WON (last player standing) — ${winAmount} Birr`);

      // Cleanup after delay
      setTimeout(() => {
        this._cleanupGame(gameId);
      }, 30000);

    } catch (error) {
      logger.error('Error awarding win to remaining player:', error);
    }
  }

  /**
   * Helper: Close winner window and process all pending winners
   */
  async _closeWinnerWindow(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game || game.winnerWindowClosed) return;

    game.winnerWindowClosed = true;
    logger.info(`Closing winner window for game ${gameId} with ${game.pendingWinners.length} winner(s)`);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get game from DB
      const { rows: [dbGame] } = await client.query(
        'SELECT * FROM games WHERE id = $1',
        [gameId]
      );

      if (!dbGame) {
        await client.query('ROLLBACK');
        return;
      }

      const prizePool = Number(dbGame.prize_pool);
      const winnerCount = game.pendingWinners.length;
      const totalPayout = Math.floor(prizePool * (game.winningPercentage / 100));
      const prizePerWinner = Math.floor(totalPayout / winnerCount);

      // Update all winners' balances
      for (const winner of game.pendingWinners) {
        await client.query(
          'UPDATE users SET main_wallet = main_wallet + $1, games_won = games_won + 1 WHERE telegram_id = $2',
          [prizePerWinner, winner.telegramId]
        );
        winner.winAmount = prizePerWinner;
      }

      // Update all players games_played
      const playerIds = Array.from(game.players);
      if (playerIds.length > 0) {
        await client.query(
          'UPDATE users SET games_played = games_played + 1 WHERE telegram_id = ANY($1)',
          [playerIds]
        );
      }

      // Prepare winners array for DB
      const winnersData = game.pendingWinners.map(w => ({
        telegramId: w.telegramId,
        boardNumber: w.boardNumber,
        timestamp: w.timestamp,
        winAmount: prizePerWinner
      }));

      // Mark game as completed with multiple winners
      await client.query(
        `UPDATE games SET
          status = $1,
          winner_id = $2,
          winner_board_number = $3,
          winners = $4,
          winner_count = $5,
          prize_per_winner = $6,
          finished_at = NOW()
        WHERE id = $7`,
        [
          GAME_STATES.COMPLETED,
          game.pendingWinners[0].telegramId, // First winner for backward compatibility
          game.pendingWinners[0].boardNumber,
          JSON.stringify(winnersData),
          winnerCount,
          prizePerWinner,
          gameId
        ]
      );

      await client.query('COMMIT');

      // Update in-memory
      game.status = GAME_STATES.COMPLETED;
      game.winnerId = game.pendingWinners[0].telegramId;

      // Stop number calling
      this._stopTimers(gameId);

      // Get winner names
      const winnerDetails = [];
      for (const winner of game.pendingWinners) {
        const [user] = await db.select().from(users).where(eq(users.telegramId, winner.telegramId)).limit(1);
        const winnerName = user ? (user.firstName || user.username || `User ${winner.telegramId}`) : `User ${winner.telegramId}`;
        winnerDetails.push({
          telegramId: winner.telegramId,
          playerName: winnerName,
          boardNumber: winner.boardNumber,
          winAmount: prizePerWinner
        });
      }

      // Broadcast results
      if (winnerCount === 1) {
        // Single winner
        this._broadcastToGame(gameId, 'game_won', {
          winnerId: winnerDetails[0].telegramId,
          winnerName: winnerDetails[0].playerName,
          boardNumber: winnerDetails[0].boardNumber,
          winAmount: prizePerWinner,
          pattern: 'any',
          winningLine: null,
        });
      } else {
        // Multiple winners
        this._broadcastToGame(gameId, 'multiple_winners', {
          winners: winnerDetails,
          totalWinners: winnerCount,
          prizePerWinner,
          pattern: 'any'
        });
      }

      this.metrics.playerWins += winnerCount;
      this.metrics.gamesCompleted++;
      this.metrics.totalPayouts += (prizePerWinner * winnerCount);
      
      logger.logGameEvent('game_completed', gameId, {
        winnerCount,
        prizePerWinner,
        totalPayout: prizePerWinner * winnerCount
      });

      // Cleanup after delay
      setTimeout(() => {
        this._cleanupGame(gameId);
      }, 30000);

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error closing winner window:', error);
    } finally {
      client.release();
    }
  }



  /**
   * Player leaves a game
   */
  async leaveGame(socketId, telegramId, gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // During play - treat like abandoning the game (lose entry fee)
    if (game.status === GAME_STATES.PLAYING) {
      // Remove player from game (no refund - penalty for leaving)
      if (game.players.has(telegramId)) {
        game.players.delete(telegramId);
        game.playerBoards.delete(telegramId);
        game.playerCount--;

        logger.info(`Player ${telegramId} left game ${gameId} during play (no refund)`);

        // Broadcast player left
        this._broadcastToGame(gameId, 'player_left', {
          playerCount: game.playerCount,
          totalPot: Math.floor(game.prizePool * (game.winningPercentage / 100)),
        });

        // Check if all players left
        if (game.playerCount === 0) {
          logger.info(`All players left game ${gameId} during play. Ending game.`);
          await this._endGameNoWinner(gameId);
        } else if (game.playerCount === 1) {
          // Only 1 player remains - they win automatically
          const remainingPlayerId = Array.from(game.players)[0];
          const boardNumber = game.playerBoards.get(remainingPlayerId);
          logger.info(`Only 1 player remains in game ${gameId}. Player ${remainingPlayerId} wins automatically.`);
          
          // Award win to remaining player with transaction
          const client = await pool.connect();
          try {
            await client.query('BEGIN');
            await this._awardWinToRemainingPlayer(client, game, remainingPlayerId, boardNumber, gameId);
            await client.query('COMMIT');
            // Note: _awardWinToRemainingPlayer already broadcasts game_won
          } catch (error) {
            await client.query('ROLLBACK');
            logger.error(`Error awarding win to remaining player in game ${gameId}:`, error);
            // Fallback: end game without winner
            await this._endGameNoWinner(gameId);
          } finally {
            client.release();
          }
        }
      }

      this.connectionManager.leaveGame(socketId);
      return;
    }

    // Refund if game hasn't started
    if ([GAME_STATES.LOBBY, GAME_STATES.COUNTDOWN].includes(game.status) && game.players.has(telegramId)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Refund entry fee
        await client.query(
          'UPDATE users SET main_wallet = main_wallet + $1 WHERE telegram_id = $2',
          [game.entryFee, telegramId]
        );

        // Release board
        const boardNum = game.playerBoards.get(telegramId);
        if (boardNum) {
          await client.query(
            'UPDATE boards SET assigned_to = NULL, assigned_at = NULL WHERE game_id = $1 AND board_number = $2',
            [gameId, boardNum]
          );
        }

        // Remove game_player record
        await client.query(
          'DELETE FROM game_players WHERE game_id = $1 AND telegram_id = $2',
          [gameId, telegramId]
        );

        // Update prize pool
        const newPrizePool = Math.max(0, game.prizePool - game.entryFee);
        const commission = newPrizePool * ((100 - game.winningPercentage) / 100);
        await client.query(
          'UPDATE games SET player_count = player_count - 1, prize_pool = $1, commission = $2 WHERE id = $3',
          [newPrizePool.toString(), commission.toString(), gameId]
        );

        await client.query('COMMIT');

        // Update in-memory
        game.players.delete(telegramId);
        game.playerBoards.delete(telegramId);
        game.playerCount--;
        game.prizePool = newPrizePool;
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Error leaving game:', error);
      } finally {
        client.release();
      }
    }

    this.connectionManager.leaveGame(socketId);

    this._broadcastToGame(gameId, 'player_left', {
      playerCount: game.playerCount,
      totalPot: Math.floor(game.prizePool * (game.winningPercentage / 100)),
    });

    // Check if all players left during lobby/countdown
    if (game.playerCount === 0 && [GAME_STATES.LOBBY, GAME_STATES.COUNTDOWN].includes(game.status)) {
      logger.info(`All players left game ${gameId} during ${game.status}. Cancelling game.`);
      await this._cancelGame(gameId, 'All players left');
    }
  }

  /**
   * Get available (unassigned) board numbers for a game
   */
  _getAvailableBoards(game) {
    const assigned = new Set(game.playerBoards.values());
    const available = [];
    for (let i = 1; i <= BOARDS_PER_GAME; i++) {
      if (!assigned.has(i)) available.push(i);
    }
    return available;
  }

  /**
   * Get sanitized game state for client
   */
  _getGameState(game) {
    return {
      gameId: game.id,
      roomId: game.roomId,
      roomName: game.roomName,
      entryFee: game.entryFee,
      status: game.status,
      playerCount: game.playerCount,
      maxPlayers: game.maxPlayers,
      totalPot: Math.floor(game.prizePool * (game.winningPercentage / 100)),
      calledNumbers: game.calledNumbers,
      callCount: game.calledNumbers.length,
      countdownRemaining: game.countdownRemaining,
      currentCall: game.calledNumbers.length > 0
        ? { letter: getBingoLetter(game.calledNumbers[game.calledNumbers.length - 1]), number: game.calledNumbers[game.calledNumbers.length - 1] }
        : null,
    };
  }

  /**
   * Cancel a game and refund all players
   */
  async _cancelGame(gameId, reason) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    this._stopTimers(gameId);
    game.status = GAME_STATES.CANCELLED;

    // Refund all players
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const telegramId of game.players) {
        await client.query(
          'UPDATE users SET main_wallet = main_wallet + $1 WHERE telegram_id = $2',
          [game.entryFee, telegramId]
        );
      }

      await client.query(
        'UPDATE games SET status = $1, finished_at = NOW() WHERE id = $2',
        [GAME_STATES.CANCELLED, gameId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cancelling game:', error);
    } finally {
      client.release();
    }

    this._broadcastToGame(gameId, 'game_ended', { reason });

    this.metrics.gamesCancelled++;
    logger.logGameEvent('game_cancelled', gameId, { reason });

    setTimeout(() => this._cleanupGame(gameId), 10000);
  }

  /**
   * End game with no winner (all 75 numbers called)
   */
  async _endGameNoWinner(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    this._stopTimers(gameId);
    game.status = GAME_STATES.COMPLETED;

    // Refund all players since no one won
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const telegramId of game.players) {
        await client.query(
          'UPDATE users SET main_wallet = main_wallet + $1, games_played = games_played + 1 WHERE telegram_id = $2',
          [game.entryFee, telegramId]
        );
      }

      await client.query(
        'UPDATE games SET status = $1, finished_at = NOW() WHERE id = $2',
        [GAME_STATES.COMPLETED, gameId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error ending game:', error);
    } finally {
      client.release();
    }

    this._broadcastToGame(gameId, 'game_ended', {
      reason: 'All numbers called — no winner. Entry fees refunded.',
    });

    setTimeout(() => this._cleanupGame(gameId), 10000);
  }

  /**
   * Get winner information for a completed game
   * @param {number} gameId
   * @returns {Promise<{winnerName: string, winAmount: number}|null>}
   */
  async getGameWinner(gameId) {
    try {
      const result = await pool.query(
        `SELECT 
          g.winner_id,
          g.prize_per_winner as win_amount,
          u.first_name,
          u.last_name,
          u.username
         FROM games g
         LEFT JOIN users u ON u.telegram_id = g.winner_id
         WHERE g.id = $1 AND g.winner_id IS NOT NULL
         LIMIT 1`,
        [gameId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        // Build winner name from available fields
        const winnerName = row.first_name 
          ? `${row.first_name}${row.last_name ? ' ' + row.last_name : ''}`
          : row.username || `User ${row.winner_id}`;
        
        return {
          winnerName,
          winAmount: parseFloat(row.win_amount || 0)
        };
      }
      return null;
    } catch (error) {
      logger.error(`Error getting winner for game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Pause game when all players disconnect
   * Stops number calling but keeps game state
   * @param {number} gameId
   */
  async pauseGame(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Only pause if game is actively playing
    if (game.status !== GAME_STATES.PLAYING) {
      return;
    }

    // Already paused
    if (game.paused) {
      logger.debug(`Game ${gameId} is already paused`);
      return;
    }

    logger.logGameEvent('game_paused', gameId, {
      playerCount: game.playerCount,
      calledNumbers: game.calledNumbers.length
    });
    
    // Stop number calling timer
    this._stopTimers(gameId);
    
    // Mark game as paused (but keep it in PLAYING state for reconnection)
    game.paused = true;
    game.pausedAt = Date.now();
    this.metrics.gamesPaused++;
    
    // Update connection manager
    this.connectionManager.setGamePaused(gameId, true);
    
    // Persist pause state to database
    try {
      await db.update(games)
        .set({ 
          paused: true,
          pausedAt: new Date()
        })
        .where(eq(games.id, gameId));
    } catch (error) {
      logger.error(`Error persisting pause state for game ${gameId}:`, error);
    }
    
    logger.info(`Game ${gameId} paused. Waiting for players to reconnect.`);
  }

  /**
   * Resume game when players reconnect
   * Restarts number calling and cancels any pending timeout
   * @param {number} gameId
   */
  async resumeGame(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return;

    // Only resume if game was paused
    if (!game.paused) {
      return;
    }

    const pauseDuration = Date.now() - game.pausedAt;
    logger.logGameEvent('game_resumed', gameId, {
      pauseDurationMs: pauseDuration,
      playerCount: game.playerCount
    });
    
    // Cancel any pending house win timeout
    const pauseTimeout = this.pauseTimeouts.get(gameId);
    if (pauseTimeout) {
      clearTimeout(pauseTimeout);
      this.pauseTimeouts.delete(gameId);
      logger.debug(`Cancelled house win timeout for game ${gameId}`);
    }
    
    // Clear pause state
    game.paused = false;
    delete game.pausedAt;
    this.metrics.gamesResumed++;
    
    // Update connection manager
    this.connectionManager.setGamePaused(gameId, false);
    
    // Persist resume state to database
    try {
      await db.update(games)
        .set({ 
          paused: false,
          pausedAt: null
        })
        .where(eq(games.id, gameId));
    } catch (error) {
      logger.error(`Error persisting resume state for game ${gameId}:`, error);
    }
    
    // Resume number calling
    this._scheduleNextCall(gameId);
    
    logger.info(`Game ${gameId} resumed after ${Math.round(pauseDuration / 1000)}s pause`);
  }

  /**
   * End game when all players disconnect and don't reconnect within grace period
   * House wins - no refunds issued
   * @param {number} gameId
   */
  async endGameHouseWins(gameId) {
    // Idempotency check - prevent duplicate calls
    if (this.endingGames.has(gameId)) {
      logger.debug(`Game ${gameId} is already being ended, skipping duplicate call`);
      return;
    }

    const game = this.activeGames.get(gameId);
    if (!game) {
      logger.debug(`Game ${gameId} not found, may have already ended`);
      return;
    }

    // Check if game is already completed
    if (game.status === GAME_STATES.COMPLETED || game.status === GAME_STATES.CANCELLED) {
      logger.debug(`Game ${gameId} already ended with status ${game.status}`);
      return;
    }

    // Mark as ending
    this.endingGames.add(gameId);

    try {
      // Verify no players are connected
      const connectedPlayers = this.connectionManager.getGamePlayerCount(gameId);
      if (connectedPlayers > 0) {
        logger.debug(`Game ${gameId} has ${connectedPlayers} connected players, not ending`);
        this.endingGames.delete(gameId);
        return;
      }

      this.metrics.houseWins++;
      this.metrics.gamesCompleted++;
      this.metrics.totalBetsCollected += game.prizePool;
      
      logger.logGameEvent('house_wins', gameId, {
        prizePool: game.prizePool,
        playerCount: game.players.size,
        calledNumbers: game.calledNumbers.length
      });
      
      this._stopTimers(gameId);
      
      // Clear any pause timeout
      const pauseTimeout = this.pauseTimeouts.get(gameId);
      if (pauseTimeout) {
        clearTimeout(pauseTimeout);
        this.pauseTimeouts.delete(gameId);
      }
      
      game.status = GAME_STATES.COMPLETED;

      // NO REFUNDS - House keeps the money
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Mark game as completed with house win
        await client.query(
          `UPDATE games 
           SET status = $1, 
               finished_at = NOW(),
               notes = 'House win - all players disconnected and did not reconnect within grace period',
               paused = false,
               paused_at = NULL
           WHERE id = $2`,
          [GAME_STATES.COMPLETED, gameId]
        );

        await client.query('COMMIT');
        logger.info(`Game ${gameId} ended. House wins ${game.prizePool}. No refunds issued to ${game.players.size} players.`);
      } catch (error) {
        await client.query('ROLLBACK');
        logger.error(`Error ending abandoned game ${gameId}:`, error);
        throw error;
      } finally {
        client.release();
      }

      // Clean up game from memory
      this._cleanupGame(gameId);
    } finally {
      // Always remove from ending set
      this.endingGames.delete(gameId);
    }
  }

  /**
   * DEPRECATED - DO NOT USE
   * This function is kept for reference but should NOT be called
   * Players disconnecting should NEVER trigger refunds
   */
  async endGameAllPlayersLeft(gameId) {
    logger.warn(`endGameAllPlayersLeft called for game ${gameId} - THIS FUNCTION IS DEPRECATED`);
    logger.warn(`Use endGameHouseWins instead - no refunds should be issued`);
    return; // Do nothing
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Broadcast message to all players in a game using Socket.IO rooms
   */
  _broadcastToGame(gameId, event, data) {
    this.io.to(`game:${gameId}`).emit(event, data);
  }

  /**
   * Stop all timers for a game
   */
  _stopTimers(gameId) {
    const callTimer = this.callTimers.get(gameId);
    if (callTimer) {
      clearTimeout(callTimer);
      this.callTimers.delete(gameId);
    }

    const countdownTimer = this.countdownTimers.get(gameId);
    if (countdownTimer) {
      clearInterval(countdownTimer);
      this.countdownTimers.delete(gameId);
    }

    const pauseTimeout = this.pauseTimeouts.get(gameId);
    if (pauseTimeout) {
      clearTimeout(pauseTimeout);
      this.pauseTimeouts.delete(gameId);
    }
  }

  /**
   * Clean up a finished game from memory
   */
  _cleanupGame(gameId) {
    this._stopTimers(gameId);
    this.activeGames.delete(gameId);
    logger.info(`Game ${gameId} cleaned up from memory`);
  }

  /**
   * Clean up all finished games older than 5 minutes
   * Also cleanup abandoned paused games older than 10 minutes
   */
  cleanupFinished() {
    const now = Date.now();
    for (const [gameId, game] of this.activeGames) {
      // Cleanup completed/cancelled games older than 5 minutes
      if ([GAME_STATES.COMPLETED, GAME_STATES.CANCELLED].includes(game.status)) {
        if (now - game.createdAt > 300000) {
          this._cleanupGame(gameId);
        }
      }
      // Cleanup abandoned paused games older than 10 minutes
      else if (game.paused && game.pausedAt) {
        const pauseDuration = now - game.pausedAt;
        if (pauseDuration > 600000) { // 10 minutes
          logger.warn(`Cleaning up abandoned paused game ${gameId} (paused for ${Math.round(pauseDuration / 1000)}s)`);
          this.endGameHouseWins(gameId).catch(err =>
            logger.error(`Error ending abandoned paused game ${gameId}:`, err)
          );
        }
      }
    }
  }

  /**
   * Gracefully finish all active games (for shutdown)
   */
  async finishAllGames() {
    const promises = [];
    for (const [gameId, game] of this.activeGames) {
      if ([GAME_STATES.PLAYING, GAME_STATES.COUNTDOWN, GAME_STATES.LOBBY].includes(game.status)) {
        promises.push(this._cancelGame(gameId, 'Server shutting down'));
      }
    }
    await Promise.allSettled(promises);
  }

  /**
   * Get user balance
   */
  async getUserBalance(telegramId) {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    if (!user) return null;
    return {
      mainWallet: Number(user.mainWallet),
      playWallet: Number(user.playWallet),
      total: Number(user.mainWallet) + Number(user.playWallet),
    };
  }

  /**
   * Check if user is in an active game (for reconnection)
   */
  async getUserActiveGame(telegramId) {
    // Check all active games in memory
    for (const [gameId, game] of this.activeGames) {
      if (game.players && game.players.has(telegramId)) {
        const boardNumber = game.playerBoards ? game.playerBoards.get(telegramId) : null;
        const boardContent = (boardNumber && game.boards) ? game.boards.get(boardNumber) : null;
        
        return {
          gameId,
          game: this._getGameState(game),
          boardNumber,
          boardContent,
        };
      }
    }
    return null;
  }

  /**
   * Get game state (public method for checking game status)
   */
  async getGameState(gameId) {
    const game = this.activeGames.get(gameId);
    if (!game) return null;
    
    return {
      id: gameId,
      status: game.status,
      playerCount: game.playerCount,
      calledNumbers: game.calledNumbers,
    };
  }

  /**
   * Get engine stats for monitoring
   */
  getStats() {
    return {
      activeGames: this.activeGames.size,
      metrics: { ...this.metrics },
      memory: {
        activeGames: this.activeGames.size,
        callTimers: this.callTimers.size,
        countdownTimers: this.countdownTimers.size,
        pauseTimeouts: this.pauseTimeouts.size,
        endingGames: this.endingGames.size
      }
    };
  }

  /**
   * Reset metrics (for testing or periodic reset)
   */
  resetMetrics() {
    this.metrics = {
      gamesCreated: 0,
      gamesCompleted: 0,
      gamesCancelled: 0,
      gamesPaused: 0,
      gamesResumed: 0,
      houseWins: 0,
      playerWins: 0,
      totalBetsCollected: 0,
      totalPayouts: 0
    };
  }

  /**
   * Destroy engine (for shutdown)
   */
  destroy() {
    clearInterval(this._cleanupInterval);
    for (const [gameId] of this.activeGames) {
      this._stopTimers(gameId);
    }
    this.activeGames.clear();
  }

  /**
   * Retry database operations with exponential backoff
   * @param {Function} operation - Async function to retry
   * @param {string} operationName - Name for logging
   * @param {number} maxRetries - Maximum retry attempts (default: 3)
   * @throws {Error} Throws the last error if all retries fail
   */
  async _retryDbOperation(operation, operationName, maxRetries = 3) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await operation();
        if (attempt > 1) {
          logger.info(`${operationName} succeeded on attempt ${attempt}`);
        }
        return;
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Max 5s
          logger.warn(`Error ${operationName} (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms:`, err.message);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    logger.error(`Error ${operationName} after ${maxRetries} attempts:`, lastError);
    throw lastError; // Propagate error to caller
  }
}

module.exports = { BingoEngine };
