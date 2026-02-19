const { eq, sql, desc } = require('drizzle-orm');
const { db } = require('../database');
const { withdrawals, users } = require('../database/schema');
const userService = require('./user.service');
const logger = require('../utils/logger');
const { MIN_WITHDRAW } = require('../config/env');

/**
 * Create a withdrawal request (now persisted to PostgreSQL, not in-memory)
 */
const createWithdrawal = async (telegramId, amount, method, accountNumber) => {
  try {
    const user = await userService.getUser(telegramId);
    if (!user) {
      throw new Error('User not found');
    }

    if (amount < MIN_WITHDRAW) {
      throw new Error(`Minimum withdrawal is ${MIN_WITHDRAW} ብር`);
    }

    if (Number(user.mainWallet) < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct from wallet immediately (hold)
    await userService.updateBalance(telegramId, 'main', -amount);

    const [withdrawal] = await db.insert(withdrawals).values({
      telegramId,
      amount: String(amount),
      method,
      accountNumber,
      status: 'pending',
    }).returning();

    logger.info(`Withdrawal created: ${withdrawal.id} - ${amount} to ${accountNumber}`);
    return withdrawal;
  } catch (error) {
    logger.error('Error creating withdrawal:', error);
    throw error;
  }
};

/**
 * Complete a withdrawal
 */
const completeWithdrawal = async (withdrawalId, adminId) => {
  try {
    const rows = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1);
    const withdrawal = rows[0];
    if (!withdrawal || (withdrawal.status !== 'pending' && withdrawal.status !== 'under_review')) {
      throw new Error('Withdrawal not found or already processed');
    }

    const [updated] = await db.update(withdrawals)
      .set({
        status: 'completed',
        processedBy: adminId,
        processedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawalId))
      .returning();

    // Update user's total withdrawn
    await db.update(users)
      .set({ totalWithdrawn: sql`${users.totalWithdrawn} + ${Number(withdrawal.amount)}` })
      .where(eq(users.telegramId, withdrawal.telegramId));

    logger.info(`Withdrawal completed: ${withdrawalId} by admin ${adminId}`);
    return updated;
  } catch (error) {
    logger.error('Error completing withdrawal:', error);
    throw error;
  }
};

/**
 * Reject a withdrawal (refund)
 */
const rejectWithdrawal = async (withdrawalId, adminId, reason = 'Rejected') => {
  try {
    const rows = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1);
    const withdrawal = rows[0];
    if (!withdrawal || withdrawal.status !== 'pending') {
      throw new Error('Withdrawal not found or already processed');
    }

    const [updated] = await db.update(withdrawals)
      .set({
        status: 'rejected',
        processedBy: adminId,
        processedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(withdrawals.id, withdrawalId))
      .returning();

    // Refund the amount
    await userService.updateBalance(withdrawal.telegramId, 'main', Number(withdrawal.amount));

    logger.info(`Withdrawal rejected and refunded: ${withdrawalId} by admin ${adminId}`);
    return updated;
  } catch (error) {
    logger.error('Error rejecting withdrawal:', error);
    throw error;
  }
};

/**
 * Get pending withdrawals
 */
const getPendingWithdrawals = async () => {
  return db.select().from(withdrawals)
    .where(eq(withdrawals.status, 'pending'))
    .orderBy(desc(withdrawals.createdAt));
};

/**
 * Get withdrawal by ID
 */
const getWithdrawal = async (withdrawalId) => {
  const rows = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1);
  return rows[0] || null;
};

module.exports = {
  createWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  getPendingWithdrawals,
  getWithdrawal,
};
