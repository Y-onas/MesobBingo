const { eq, sql, desc } = require('drizzle-orm');
const { db } = require('../database');
const { deposits, users } = require('../database/schema');
const userService = require('./user.service');
const logger = require('../utils/logger');

/**
 * Create a new deposit request
 */
const createDeposit = async (telegramId, amount, method, screenshotFileId = null, transactionRef = null, smsText = null) => {
  try {
    const [deposit] = await db.insert(deposits).values({
      telegramId,
      amount: String(amount),
      method,
      screenshotFileId,
      transactionRef,
      smsText,
      status: 'pending',
    }).returning();
    logger.debug(`Deposit created: ${amount} via ${method}`);
    return deposit;
  } catch (error) {
    logger.error('Error creating deposit:', error);
    throw error;
  }
};

/**
 * Approve a deposit
 */
const approveDeposit = async (depositId, adminId) => {
  try {
    // Atomic update: only approve if status is pending or under_review
    const [updated] = await db.update(deposits)
      .set({
        status: 'approved',
        processedBy: adminId,
        processedAt: new Date(),
      })
      .where(sql`${deposits.id} = ${depositId} AND ${deposits.status} IN ('pending', 'under_review')`)
      .returning();

    if (!updated) {
      throw new Error('Deposit not found or already processed');
    }

    // Add amount to user's main wallet
    await userService.updateBalance(updated.telegramId, 'main', Number(updated.amount));

    // Increment deposit count and total
    await db.update(users)
      .set({
        depositCount: sql`${users.depositCount} + 1`,
        totalDeposited: sql`${users.totalDeposited} + ${Number(updated.amount)}`,
      })
      .where(eq(users.telegramId, updated.telegramId));

    // Process referral bonus
    await userService.processReferralBonus(updated.telegramId);

    logger.info(`Deposit approved: ${depositId} by admin ${adminId}`);
    return updated;
  } catch (error) {
    logger.error('Error approving deposit:', error);
    throw error;
  }
};

/**
 * Reject a deposit
 */
const rejectDeposit = async (depositId, adminId, reason = 'Rejected') => {
  try {
    // Atomic update: only reject if status is pending or under_review
    const [updated] = await db.update(deposits)
      .set({
        status: 'rejected',
        processedBy: adminId,
        processedAt: new Date(),
        rejectionReason: reason,
      })
      .where(sql`${deposits.id} = ${depositId} AND ${deposits.status} IN ('pending', 'under_review')`)
      .returning();

    if (!updated) {
      throw new Error('Deposit not found or already processed');
    }

    logger.info(`Deposit rejected: ${depositId} by admin ${adminId}`);
    return updated;
  } catch (error) {
    logger.error('Error rejecting deposit:', error);
    throw error;
  }
};

/**
 * Get pending deposits
 */
const getPendingDeposits = async () => {
  return db.select().from(deposits)
    .where(eq(deposits.status, 'pending'))
    .orderBy(desc(deposits.createdAt));
};

/**
 * Get deposit by ID
 */
const getDeposit = async (depositId) => {
  const rows = await db.select().from(deposits).where(eq(deposits.id, depositId)).limit(1);
  return rows[0] || null;
};

/**
 * Get user deposits
 */
const getUserDeposits = async (telegramId) => {
  return db.select().from(deposits)
    .where(eq(deposits.telegramId, telegramId))
    .orderBy(desc(deposits.createdAt));
};

module.exports = {
  createDeposit,
  approveDeposit,
  rejectDeposit,
  getPendingDeposits,
  getDeposit,
  getUserDeposits,
};
