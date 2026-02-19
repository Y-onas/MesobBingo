const { eq, sql, desc } = require('drizzle-orm');
const { db } = require('../database');
const { users, deposits } = require('../database/schema');
const userService = require('./user.service');
const logger = require('../utils/logger');

/**
 * Get bot statistics
 */
const getStats = async () => {
  try {
    const totalUsersRow = await db.select({ count: sql`count(*)` }).from(users);
    const totalUsers = Number(totalUsersRow[0].count);

    const activeUsersRow = await db.select({ count: sql`count(*)` }).from(users)
      .where(sql`${users.lastActive} >= NOW() - INTERVAL '24 hours'`);
    const activeUsers = Number(activeUsersRow[0].count);

    const depositorsRow = await db.select({ count: sql`count(*)` }).from(users)
      .where(sql`${users.depositCount} > 0`);
    const depositorsCount = Number(depositorsRow[0].count);

    const totalDepositedRow = await db.select({ total: sql`COALESCE(SUM(${users.totalDeposited}), 0)` }).from(users);
    const totalDeposited = Number(totalDepositedRow[0].total);

    const totalWithdrawnRow = await db.select({ total: sql`COALESCE(SUM(${users.totalWithdrawn}), 0)` }).from(users);
    const totalWithdrawn = Number(totalWithdrawnRow[0].total);

    const pendingDepositsRow = await db.select({ count: sql`count(*)` }).from(deposits)
      .where(eq(deposits.status, 'pending'));
    const pendingDeposits = Number(pendingDepositsRow[0].count);

    return {
      totalUsers,
      activeUsers,
      depositors: depositorsCount,
      totalDeposited,
      totalWithdrawn,
      pendingDeposits,
    };
  } catch (error) {
    logger.error('Error getting stats:', error);
    throw error;
  }
};

/**
 * Broadcast message to users
 */
const broadcastMessage = async (bot, message, depositorsOnly = false) => {
  try {
    const userList = depositorsOnly
      ? await userService.getDepositors()
      : await userService.getAllUsers();

    let success = 0;
    let failed = 0;

    for (const user of userList) {
      try {
        await bot.telegram.sendMessage(user.telegramId, message, {
          parse_mode: 'Markdown',
        });
        success++;
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        failed++;
        logger.warn(`Failed to send message to ${user.telegramId}:`, err.message);
      }
    }

    logger.info(`Broadcast completed: ${success} success, ${failed} failed`);
    return { success, failed };
  } catch (error) {
    logger.error('Error broadcasting message:', error);
    throw error;
  }
};

/**
 * Search user by ID or username
 */
const searchUser = async (query) => {
  // Try as Telegram ID first
  const numQuery = parseInt(query);
  if (!isNaN(numQuery)) {
    const user = await userService.getUser(numQuery);
    if (user) return user;
  }

  // Try as username
  const username = query.replace('@', '');
  const rows = await db.select().from(users)
    .where(sql`LOWER(${users.username}) LIKE LOWER(${'%' + username + '%'})`)
    .limit(1);
  return rows[0] || null;
};

/**
 * Get top users by balance
 */
const getTopUsers = async (limit = 10) => {
  return db.select().from(users)
    .orderBy(desc(users.mainWallet))
    .limit(limit);
};

/**
 * Get recent approved deposits
 */
const getRecentDeposits = async (limit = 10) => {
  return db.select().from(deposits)
    .where(eq(deposits.status, 'approved'))
    .orderBy(desc(deposits.createdAt))
    .limit(limit);
};

module.exports = {
  getStats,
  broadcastMessage,
  searchUser,
  getTopUsers,
  getRecentDeposits,
};
