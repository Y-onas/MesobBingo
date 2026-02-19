const userService = require('../services/user.service');
const { mainKeyboard } = require('../keyboards/main.keyboard');
const { isAdmin } = require('../config/admin');
const { adminKeyboard } = require('../keyboards/main.keyboard');
const logger = require('../utils/logger');

/**
 * Handle contact sharing — verifies phone & grants one-time bonus
 */
const contactHandler = async (ctx) => {
  try {
    const contact = ctx.message.contact;

    // Only accept the user's own contact (prevent sharing others' contacts)
    if (contact.user_id !== ctx.from.id) {
      await ctx.reply('❌ Please share your own contact, not someone else\'s.');
      return;
    }

    // Verify phone & claim one-time bonus
    const user = await userService.verifyPhone(ctx.from.id, contact.phone_number);

    if (!user) {
      await ctx.reply('❌ Please use /start first before sharing your contact.');
      return;
    }

    // Select keyboard based on admin status
    const keyboard = isAdmin(ctx.from.id) ? adminKeyboard() : mainKeyboard();

    if (user.bonusClaimed) {
      // Bonus was just claimed (first time sharing contact)
      await ctx.reply(
        `✅ *Phone Verified Successfully!*\n\n🎉 You've received a *5 ብር* welcome bonus in your Play Wallet!\n\n💰 *Your Balance:*\n🏦 Main Wallet: ${Number(user.mainWallet).toFixed(2)} ብር\n🎁 Play Wallet: ${Number(user.playWallet).toFixed(2)} ብር\n\nUse the menu below to start playing! 🎰`,
        {
          parse_mode: 'Markdown',
          ...keyboard,
        }
      );
    } else {
      // Phone already verified before
      await ctx.reply('✅ Phone number updated successfully!', keyboard);
    }
  } catch (error) {
    logger.error('Error in contact handler:', error);
    await ctx.reply('❌ An error occurred. Please try again.').catch(() => {});
  }
};

/**
 * Register contact handler
 */
const register = (bot) => {
  bot.on('contact', contactHandler);
};

module.exports = { register };
