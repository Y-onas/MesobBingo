const userService = require('./user.service');
const logger = require('../utils/logger');

/**
 * Add bonus to user
 */
const addBonus = async (telegramId, amount, wallet = 'play') => {
  try {
    const user = await userService.updateBalance(telegramId, wallet, amount);
    logger.info(`Bonus added: ${amount} to ${wallet} wallet for user ${telegramId}`);
    return user;
  } catch (error) {
    logger.error('Error adding bonus:', error);
    throw error;
  }
};

/**
 * Remove bonus from user
 */
const removeBonus = async (telegramId, amount, wallet = 'play') => {
  try {
    const user = await userService.getUser(telegramId);
    if (!user) {
      throw new Error('User not found');
    }

    const currentBalance = Number(wallet === 'main' ? user.mainWallet : user.playWallet);
    if (currentBalance < amount) {
      throw new Error('Cannot remove more than current balance');
    }

    const updatedUser = await userService.updateBalance(telegramId, wallet, -amount);
    logger.info(`Bonus removed: ${amount} from ${wallet} wallet for user ${telegramId}`);
    return updatedUser;
  } catch (error) {
    logger.error('Error removing bonus:', error);
    throw error;
  }
};

/**
 * Transfer funds between users
 */
const transferFunds = async (fromUserId, toUserId, amount) => {
  try {
    const fromUser = await userService.getUser(fromUserId);
    if (!fromUser || Number(fromUser.mainWallet) < amount) {
      throw new Error('Insufficient balance or user not found');
    }

    await userService.updateBalance(fromUserId, 'main', -amount);
    const toUser = await userService.updateBalance(toUserId, 'main', amount);
    const updatedFromUser = await userService.getUser(fromUserId);

    logger.info(`Funds transferred: ${amount} from ${fromUserId} to ${toUserId}`);
    return { from: updatedFromUser, to: toUser };
  } catch (error) {
    logger.error('Error transferring funds:', error);
    throw error;
  }
};

module.exports = {
  addBonus,
  removeBonus,
  transferFunds,
};
