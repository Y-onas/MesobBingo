const { eq, sql } = require('drizzle-orm');
const { db } = require('../database');
const { users } = require('../database/schema');
const { REFERRAL_BONUS } = require('../config/env');
const logger = require('../utils/logger');

/**
 * Create or get user
 */
const createOrGetUser = async (telegramUser, referrerId = null) => {
  try {
    const existing = await db.select().from(users).where(eq(users.telegramId, telegramUser.id)).limit(1);

    if (existing.length === 0) {
      // New user — do NOT give play wallet bonus here; it comes after phone verification
      const [newUser] = await db.insert(users).values({
        telegramId: telegramUser.id,
        username: telegramUser.username || null,
        firstName: telegramUser.first_name || '',
        lastName: telegramUser.last_name || '',
        referredBy: referrerId,
        playWallet: '0',
        bonusClaimed: false,
        phoneVerified: false,
      }).returning();

      logger.info(`New user created: ${telegramUser.id}`);

      // If referred, increment referrer's count
      if (referrerId) {
        await db.update(users)
          .set({ referralCount: sql`${users.referralCount} + 1` })
          .where(eq(users.telegramId, referrerId));
        logger.info(`Referral count incremented for: ${referrerId}`);
      }

      return newUser;
    }

    // Existing user — update last active and info
    const [updated] = await db.update(users)
      .set({
        lastActive: new Date(),
        ...(telegramUser.username ? { username: telegramUser.username } : {}),
        ...(telegramUser.first_name ? { firstName: telegramUser.first_name } : {}),
      })
      .where(eq(users.telegramId, telegramUser.id))
      .returning();

    return updated;
  } catch (error) {
    logger.error('Error in createOrGetUser:', error);
    throw error;
  }
};

/**
 * Get user by Telegram ID
 */
const getUser = async (telegramId) => {
  const rows = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  return rows[0] || null;
};

/**
 * Update user balance
 */
const updateBalance = async (telegramId, wallet, amount) => {
  const field = wallet === 'main' ? users.mainWallet : users.playWallet;
  const [updated] = await db.update(users)
    .set({ [wallet === 'main' ? 'mainWallet' : 'playWallet']: sql`${field} + ${amount}` })
    .where(eq(users.telegramId, telegramId))
    .returning();
  logger.info(`Balance updated for ${telegramId}: ${wallet} ${amount > 0 ? '+' : ''}${amount}`);
  return updated;
};

/**
 * Process referral bonus on deposit
 */
const processReferralBonus = async (depositorId) => {
  try {
    const depositor = await getUser(depositorId);
    if (!depositor || !depositor.referredBy) return;

    await db.update(users)
      .set({
        mainWallet: sql`${users.mainWallet} + ${REFERRAL_BONUS}`,
        referralEarnings: sql`${users.referralEarnings} + ${REFERRAL_BONUS}`,
      })
      .where(eq(users.telegramId, depositor.referredBy));

    logger.info(`Referral bonus ${REFERRAL_BONUS} added to ${depositor.referredBy} for ${depositorId}'s deposit`);
  } catch (error) {
    logger.error('Error processing referral bonus:', error);
  }
};

/**
 * Get all users count
 */
const getUsersCount = async () => {
  const rows = await db.select({ count: sql`count(*)` }).from(users);
  return Number(rows[0].count);
};

/**
 * Get depositors (users with at least one deposit)
 */
const getDepositors = async () => {
  return db.select().from(users).where(sql`${users.depositCount} > 0`);
};

/**
 * Get all active (non-banned) users
 */
const getAllUsers = async () => {
  return db.select().from(users).where(eq(users.isBanned, false));
};

/**
 * Ban/Unban user
 */
const setBanned = async (telegramId, banned) => {
  const [updated] = await db.update(users)
    .set({ isBanned: banned })
    .where(eq(users.telegramId, telegramId))
    .returning();
  return updated;
};

/**
 * Verify phone and claim bonus (one-time)
 */
const verifyPhone = async (telegramId, phone) => {
  const user = await getUser(telegramId);
  if (!user) return null;

  const updates = {
    phone,
    phoneVerified: true,
  };

  // Grant welcome bonus only if not already claimed
  if (!user.bonusClaimed) {
    updates.playWallet = sql`${users.playWallet} + 5`;
    updates.bonusClaimed = true;
    logger.info(`Welcome bonus of 5 granted to user ${telegramId}`);
  }

  const [updated] = await db.update(users)
    .set(updates)
    .where(eq(users.telegramId, telegramId))
    .returning();

  return updated;
};

module.exports = {
  createOrGetUser,
  getUser,
  updateBalance,
  processReferralBonus,
  getUsersCount,
  getDepositors,
  getAllUsers,
  setBanned,
  verifyPhone,
};
