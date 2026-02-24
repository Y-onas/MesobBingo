const { eq, sql, desc } = require('drizzle-orm');
const { db, pool } = require('../database');
const { withdrawals, users } = require('../database/schema');
const userService = require('./user.service');
const logger = require('../utils/logger');
const configService = require('./config.service');

/**
 * Create a withdrawal request (now persisted to PostgreSQL, not in-memory)
 * Uses transaction with SELECT FOR UPDATE to prevent race conditions
 * NEW: Only allows withdrawals from withdrawable_balance (winnings only)
 */
const createWithdrawal = async (telegramId, amount, method, accountNumber, accountHolderName) => {
  // Pre-flight validation — no DB mutation, no transaction needed
  if (!accountHolderName || accountHolderName.trim().length < 3) {
    throw new Error('Account holder name is required (minimum 3 characters)');
  }

  // Kill switch check
  const withdrawalsEnabled = await configService.get('withdrawals_enabled', true);
  if (!withdrawalsEnabled) {
    throw new Error('Withdrawals are temporarily disabled');
  }

  const MIN_WITHDRAW = Number(await configService.get('min_withdraw', 150));
  if (amount < MIN_WITHDRAW) {
    throw new Error(`Minimum withdrawal is ${MIN_WITHDRAW} ብር`);
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

    // NEW: Check withdrawable balance (winnings only)
    const withdrawableBalance = Number(user.withdrawable_balance);
    const playingBalance = Number(user.playing_balance);
    
    if (withdrawableBalance < amount) {
      await client.query('ROLLBACK');
      const error = new Error('INSUFFICIENT_WITHDRAWABLE_BALANCE');
      error.withdrawableBalance = withdrawableBalance;
      error.playingBalance = playingBalance;
      throw error;
    }

    // Deduct from withdrawable balance atomically
    await client.query(
      'UPDATE users SET withdrawable_balance = withdrawable_balance - $1, main_wallet = main_wallet - $1 WHERE telegram_id = $2',
      [amount, telegramId]
    );

    // Create withdrawal record with account holder name
    const { rows: [withdrawal] } = await client.query(
      `INSERT INTO withdrawals (telegram_id, amount, method, account_number, account_holder_name, status) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [telegramId, amount, method, accountNumber, accountHolderName, 'pending']
    );

    await client.query('COMMIT');

    logger.info(`Withdrawal created: ${withdrawal.id} - ${amount} to ${accountNumber} (${accountHolderName})`);
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
 * Uses transaction to ensure atomicity - prevents stat update failure
 */
const completeWithdrawal = async (withdrawalId, adminId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomic update: only complete if status is pending or under_review
    const { rows: [updated] } = await client.query(
      `UPDATE withdrawals 
       SET status = 'approved', 
           processed_by = $1, 
           processed_at = NOW()
       WHERE id = $2 
         AND status IN ('pending', 'under_review')
       RETURNING *`,
      [adminId, withdrawalId]
    );

    if (!updated) {
      await client.query('ROLLBACK');
      throw new Error('Withdrawal not found or already processed');
    }

    // Update user's total withdrawn
    await client.query(
      `UPDATE users 
       SET total_withdrawn = total_withdrawn + $1
       WHERE telegram_id = $2`,
      [updated.amount, updated.telegram_id]
    );

    await client.query('COMMIT');
    logger.info(`Withdrawal completed: ${withdrawalId} by admin ${adminId}`);
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error completing withdrawal:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Reject a withdrawal (refund)
 * Uses transaction to ensure atomicity - prevents fund loss if refund fails
 */
const rejectWithdrawal = async (withdrawalId, adminId, reason = 'Rejected') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Atomic update: only reject if status is pending or under_review
    const { rows: [updated] } = await client.query(
      `UPDATE withdrawals 
       SET status = 'rejected', 
           processed_by = $1, 
           processed_at = NOW(), 
           rejection_reason = $2
       WHERE id = $3 
         AND status IN ('pending', 'under_review')
       RETURNING *`,
      [adminId, reason, withdrawalId]
    );

    if (!updated) {
      await client.query('ROLLBACK');
      throw new Error('Withdrawal not found or already processed');
    }

    // Refund the amount to withdrawable balance (and legacy main_wallet)
    await client.query(
      `UPDATE users 
       SET withdrawable_balance = withdrawable_balance + $1,
           main_wallet = main_wallet + $1
       WHERE telegram_id = $2`,
      [updated.amount, updated.telegram_id]
    );

    await client.query('COMMIT');
    logger.info(`Withdrawal rejected and refunded: ${withdrawalId} by admin ${adminId}`);
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error rejecting withdrawal:', error);
    throw error;
  } finally {
    client.release();
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
