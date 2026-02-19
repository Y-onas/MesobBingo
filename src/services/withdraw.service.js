const { eq, sql, desc } = require('drizzle-orm');
const { db, pool } = require('../database');
const { withdrawals, users } = require('../database/schema');
const userService = require('./user.service');
const logger = require('../utils/logger');
const { MIN_WITHDRAW } = require('../config/env');

/**
 * Create a withdrawal request (now persisted to PostgreSQL, not in-memory)
 * Uses transaction with SELECT FOR UPDATE to prevent race conditions
 */
const createWithdrawal = async (telegramId, amount, method, accountNumber) => {
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

    if (amount < MIN_WITHDRAW) {
      await client.query('ROLLBACK');
      throw new Error(`Minimum withdrawal is ${MIN_WITHDRAW} ብር`);
    }

    const mainBalance = Number(user.main_wallet);
    if (mainBalance < amount) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient balance');
    }

    // Deduct from wallet atomically
    await client.query(
      'UPDATE users SET main_wallet = main_wallet - $1 WHERE telegram_id = $2',
      [amount, telegramId]
    );

    // Create withdrawal record
    const { rows: [withdrawal] } = await client.query(
      `INSERT INTO withdrawals (telegram_id, amount, method, account_number, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [telegramId, String(amount), method, accountNumber, 'pending']
    );

    await client.query('COMMIT');

    logger.info(`Withdrawal created: ${withdrawal.id} - ${amount} to ${accountNumber}`);
    return withdrawal;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating withdrawal:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Complete a withdrawal
 */
const completeWithdrawal = async (withdrawalId, adminId) => {
  try {
    // Atomic update: only complete if status is pending or under_review
    const [updated] = await db.update(withdrawals)
      .set({
        status: 'approved',
        processedBy: adminId,
        processedAt: new Date(),
      })
      .where(sql`${withdrawals.id} = ${withdrawalId} AND ${withdrawals.status} IN ('pending', 'under_review')`)
      .returning();

    if (!updated) {
      throw new Error('Withdrawal not found or already processed');
    }

    // Update user's total withdrawn
    await db.update(users)
      .set({ totalWithdrawn: sql`${users.totalWithdrawn} + ${Number(updated.amount)}` })
      .where(eq(users.telegramId, updated.telegramId));

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
    // Atomic update: only reject if status is pending or under_review
    const [updated] = await db.update(withdrawals)
      .set({
        status: 'rejected',
        processedBy: adminId,
        processedAt: new Date(),
        rejectionReason: reason,
      })
      .where(sql`${withdrawals.id} = ${withdrawalId} AND ${withdrawals.status} IN ('pending', 'under_review')`)
      .returning();

    if (!updated) {
      throw new Error('Withdrawal not found or already processed');
    }

    // Refund the amount
    await userService.updateBalance(updated.telegramId, 'main', Number(updated.amount));

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
