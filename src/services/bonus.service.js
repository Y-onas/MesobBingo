const { pool } = require('../database');
const userService = require('./user.service');
const logger = require('../utils/logger');

/**
 * Add bonus to user
 */
const addBonus = async (telegramId, amount, wallet = 'play') => {
  try {
    const user = await userService.updateBalance(telegramId, wallet, amount);
    logger.debug(`Bonus added: ${amount} to ${wallet} wallet`);
    return user;
  } catch (error) {
    logger.error('Error adding bonus:', error);
    throw error;
  }
};

/**
 * Remove bonus from user
 * Uses transaction with SELECT FOR UPDATE to prevent race conditions
 */
const removeBonus = async (telegramId, amount, wallet = 'play') => {
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

    const currentBalance = Number(wallet === 'main' ? user.main_wallet : user.play_wallet);
    if (currentBalance < amount) {
      await client.query('ROLLBACK');
      throw new Error('Cannot remove more than current balance');
    }

    // Deduct atomically
    const column = wallet === 'main' ? 'main_wallet' : 'play_wallet';
    await client.query(
      `UPDATE users SET ${column} = ${column} - $1 WHERE telegram_id = $2`,
      [amount, telegramId]
    );

    await client.query('COMMIT');

    logger.debug(`Bonus removed: ${amount} from ${wallet} wallet`);
    
    // Return updated user
    const updatedUser = await userService.getUser(telegramId);
    return updatedUser;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error removing bonus:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Transfer funds between users
 * Uses transaction with SELECT FOR UPDATE to prevent race conditions
 */
const transferFunds = async (fromUserId, toUserId, amount) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock both user rows for update (ordered by ID to prevent deadlocks)
    const lockOrder = fromUserId < toUserId ? [fromUserId, toUserId] : [toUserId, fromUserId];
    
    for (const userId of lockOrder) {
      await client.query(
        'SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE',
        [userId]
      );
    }

    // Get from user
    const { rows: [fromUser] } = await client.query(
      'SELECT * FROM users WHERE telegram_id = $1',
      [fromUserId]
    );

    if (!fromUser) {
      await client.query('ROLLBACK');
      throw new Error('Sender not found');
    }

    const fromBalance = Number(fromUser.main_wallet);
    if (fromBalance < amount) {
      await client.query('ROLLBACK');
      throw new Error('Insufficient balance');
    }

    // Deduct from sender
    await client.query(
      'UPDATE users SET main_wallet = main_wallet - $1 WHERE telegram_id = $2',
      [amount, fromUserId]
    );

    // Add to receiver
    await client.query(
      'UPDATE users SET main_wallet = main_wallet + $1 WHERE telegram_id = $2',
      [amount, toUserId]
    );

    await client.query('COMMIT');

    logger.info(`Funds transferred: ${amount} from ${fromUserId} to ${toUserId}`);
    
    // Return updated users
    const updatedFromUser = await userService.getUser(fromUserId);
    const toUser = await userService.getUser(toUserId);
    return { from: updatedFromUser, to: toUser };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error transferring funds:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  addBonus,
  removeBonus,
  transferFunds,
};
