/**
 * DEPRECATED: This service is for legacy single-player bingo games
 * 
 * For multiplayer room-based games, use src/services/bingo-engine.js instead.
 * This service is kept for backward compatibility only.
 * 
 * DO NOT ADD NEW FEATURES HERE - use BingoEngine instead.
 */

const { eq, sql } = require('drizzle-orm');
const { db, pool } = require('../database');
const { users } = require('../database/schema');
const userService = require('./user.service');
const logger = require('../utils/logger');
const { generateBingoNumbers, checkWin } = require('../utils/helpers');
const { GAME_STAKES } = require('../utils/constants');

// In-memory game state (game sessions are ephemeral, DB not needed)
const activeGames = new Map();

/**
 * Start a new game
 */
const startGame = (telegramId, stake, board) => {
  const game = {
    telegramId,
    stake,
    board,
    selectedNumbers: [],
    winningNumbers: null,
    status: 'selecting',
    createdAt: new Date(),
  };
  activeGames.set(telegramId, game);
  return game;
};

/**
 * Get active game for user
 */
const getActiveGame = (telegramId) => {
  return activeGames.get(telegramId) || null;
};

/**
 * Select a number
 */
const selectNumber = (telegramId, number) => {
  const game = activeGames.get(telegramId);
  if (!game) {
    throw new Error('No active game');
  }

  if (game.selectedNumbers.includes(number)) {
    game.selectedNumbers = game.selectedNumbers.filter(n => n !== number);
  } else if (game.selectedNumbers.length < 5) {
    game.selectedNumbers.push(number);
    game.selectedNumbers.sort((a, b) => a - b);
  }

  return game;
};

/**
 * Clear selected numbers
 */
const clearNumbers = (telegramId) => {
  const game = activeGames.get(telegramId);
  if (game) {
    game.selectedNumbers = [];
  }
  return game;
};

/**
 * Play the game
 * Uses transaction with SELECT FOR UPDATE to prevent race conditions
 */
const playGame = async (telegramId) => {
  const game = activeGames.get(telegramId);
  if (!game) {
    throw new Error('No active game');
  }

  if (game.selectedNumbers.length !== 5) {
    throw new Error('Please select exactly 5 numbers');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock user row for update
    const { rows: [user] } = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
      [telegramId]
    );

    if (!user) {
      await client.query('ROLLBACK');
      throw new Error('User not found');
    }

    // Prefer play wallet, then main wallet
    const playBalance = Number(user.play_wallet);
    const mainBalance = Number(user.main_wallet);
    let wallet = 'play';

    if (playBalance >= game.stake) {
      // Deduct from play wallet
      await client.query(
        'UPDATE users SET play_wallet = play_wallet - $1 WHERE telegram_id = $2',
        [game.stake, telegramId]
      );
    } else if (mainBalance >= game.stake) {
      // Deduct from main wallet
      wallet = 'main';
      await client.query(
        'UPDATE users SET main_wallet = main_wallet - $1 WHERE telegram_id = $2',
        [game.stake, telegramId]
      );
    } else {
      await client.query('ROLLBACK');
      throw new Error('Insufficient balance');
    }

    await client.query('COMMIT');

    // Generate winning numbers
    game.winningNumbers = generateBingoNumbers(5, 1, 90);
    game.status = 'completed';

    // Check win
    const matches = game.selectedNumbers.filter(n => game.winningNumbers.includes(n));
    game.matchCount = matches.length;
    game.isWin = matches.length >= 3;

    // Calculate winnings
    if (game.isWin) {
      let multiplier = 1;
      if (matches.length === 3) multiplier = 2;
      if (matches.length === 4) multiplier = 5;
      if (matches.length === 5) multiplier = 100;

      game.winAmount = game.stake * multiplier;
      await userService.updateBalance(telegramId, 'main', game.winAmount);

      // Update user stats
      await db.update(users)
        .set({
          gamesPlayed: sql`${users.gamesPlayed} + 1`,
          gamesWon: sql`${users.gamesWon} + 1`,
        })
        .where(eq(users.telegramId, telegramId));
    } else {
      game.winAmount = 0;
      await db.update(users)
        .set({ gamesPlayed: sql`${users.gamesPlayed} + 1` })
        .where(eq(users.telegramId, telegramId));
    }

    logger.debug(`Game completed - ${game.isWin ? 'WIN' : 'LOSE'} - Matches: ${matches.length}`);

    // Clean up game state after a delay
    setTimeout(() => {
      activeGames.delete(telegramId);
    }, 60000);

    return game;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error playing game:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Cancel game
 */
const cancelGame = (telegramId) => {
  activeGames.delete(telegramId);
};

/**
 * Validate stake amount
 */
const isValidStake = (stake) => {
  return GAME_STAKES.includes(stake);
};

module.exports = {
  startGame,
  getActiveGame,
  selectNumber,
  clearNumbers,
  playGame,
  cancelGame,
  isValidStake,
};
