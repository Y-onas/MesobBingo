const { eq, and, gte, lte, sql } = require('drizzle-orm');
const { db } = require('../database');
const { winPercentageRules, gameRooms } = require('../database/schema');
const logger = require('../utils/logger');

/**
 * Get win percentage for a room based on current player count
 * @param {number} roomId - The room ID
 * @param {number} currentPlayers - Current number of players
 * @returns {Promise<number>} Win percentage
 */
const getWinPercentage = async (roomId, currentPlayers) => {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
  
  if (!room) {
    throw new Error('Room not found');
  }

  // If dynamic percentage is disabled, return static percentage
  if (!room.useDynamicPercentage) {
    return room.winningPercentage;
  }

  // Find matching rule
  const [rule] = await db.select()
    .from(winPercentageRules)
    .where(
      and(
        eq(winPercentageRules.roomId, roomId),
        lte(winPercentageRules.minPlayers, currentPlayers),
        gte(winPercentageRules.maxPlayers, currentPlayers)
      )
    )
    .limit(1);

  if (rule) {
    return rule.winPercentage;
  }

  // Smart fallback: adjust static percentage based on player count
  // If no rules defined, use dynamic adjustment:
  // - Below average (< maxPlayers/2): Add 5% (fewer players = higher payout)
  // - Above average (>= maxPlayers/2): Subtract 5% (more players = lower payout)
  const basePercentage = room.winningPercentage;
  const midPoint = room.maxPlayers / 2;
  
  let adjustedPercentage;
  if (currentPlayers < midPoint) {
    // Fewer players - increase win percentage
    adjustedPercentage = Math.min(basePercentage + 5, 100);
    logger.info(`No rules found for room ${roomId}, using adjusted percentage: ${adjustedPercentage}% (${currentPlayers} < ${midPoint} players, +5%)`);
  } else {
    // More players - decrease win percentage
    adjustedPercentage = Math.max(basePercentage - 5, 1);
    logger.info(`No rules found for room ${roomId}, using adjusted percentage: ${adjustedPercentage}% (${currentPlayers} >= ${midPoint} players, -5%)`);
  }
  
  return adjustedPercentage;
};

/**
 * Recalculate room financials based on current player count
 * @param {number} roomId - The room ID
 * @returns {Promise<Object>} Updated financial values
 */
const recalculateRoomFinancials = async (roomId) => {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
  
  if (!room) {
    throw new Error('Room not found');
  }

  const winPercentage = await getWinPercentage(roomId, room.currentPlayers);

  const totalPot = Number(room.totalPot);
  const expectedPayout = totalPot * (winPercentage / 100);
  const commission = totalPot - expectedPayout;

  // Only update financial calculations, preserve the static winningPercentage field
  // The static percentage is used as fallback when dynamic percentage is disabled
  await db.update(gameRooms)
    .set({
      expectedPayout: String(expectedPayout.toFixed(2)),
      commission: String(commission.toFixed(2)),
    })
    .where(eq(gameRooms.id, roomId));

  logger.info(`Recalculated room ${roomId} financials: ${room.currentPlayers} players, ${winPercentage}% win, payout: ${expectedPayout.toFixed(2)}`);

  return { winPercentage, expectedPayout, commission };
};

/**
 * Validate rules for a room
 * @param {number} roomId - The room ID
 * @param {Array} rules - Array of rule objects with min_players, max_players
 * @param {boolean} requireComplete - Require complete coverage for non-empty rules (default: true)
 *                                     Note: Empty rules are always allowed (uses smart fallback)
 * @returns {Promise<boolean>} True if valid
 */
const validateRules = async (roomId, rules, requireComplete = true) => {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.id, roomId));
  
  if (!room) {
    throw new Error('Room not found');
  }

  // Allow empty rules (will use smart fallback with ±5% adjustment)
  // Empty rules are always allowed regardless of requireComplete setting
  if (rules.length === 0) {
    logger.info(`No rules for room ${roomId}, will use smart fallback (±5% based on player count)`);
    return true;
  }

  // Check for overlaps
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i];
      const b = rules[j];
      if (!(a.max_players < b.min_players || b.max_players < a.min_players)) {
        throw new Error(`Rules overlap: [${a.min_players}-${a.max_players}] and [${b.min_players}-${b.max_players}]`);
      }
    }
  }

  // Only require complete coverage if specified
  if (requireComplete) {
    // Check for complete coverage (1 to max_players)
    const sortedRules = [...rules].sort((a, b) => a.min_players - b.min_players);
    
    if (sortedRules[0].min_players !== 1) {
      throw new Error('Rules must start from 1 player');
    }
    
    for (let i = 0; i < sortedRules.length - 1; i++) {
      if (sortedRules[i].max_players + 1 !== sortedRules[i + 1].min_players) {
        throw new Error(`Gap in coverage between ${sortedRules[i].max_players} and ${sortedRules[i + 1].min_players}`);
      }
    }
    
    if (sortedRules[sortedRules.length - 1].max_players !== room.maxPlayers) {
      throw new Error(`Rules must cover up to max_players (${room.maxPlayers})`);
    }
  }

  return true;
};

module.exports = {
  getWinPercentage,
  recalculateRoomFinancials,
  validateRules,
};
