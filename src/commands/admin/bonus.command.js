const { MESSAGES, CURRENCY } = require('../../utils/constants');
const { isAdmin } = require('../../config/admin');
const bonusService = require('../../services/bonus.service');
const userService = require('../../services/user.service');
const { parseAmount } = require('../../utils/helpers');

/**
 * Handle /bonus command
 */
const bonusCommand = async (ctx) => {
  try {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply(MESSAGES.ADMIN_ONLY);
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 2) {
      return ctx.reply(`🎁 *Bonus Management*

*Usage:* \`/bonus [userId] [amount]\`
*Example:* \`/bonus 123456789 50\`

Add bonus to a user's play wallet.`, { parse_mode: 'Markdown' });
    }
    
    const userId = parseInt(args[0]);
    const amount = parseAmount(args[1]);
    
    if (isNaN(userId) || !amount || amount <= 0) {
      return ctx.reply('❌ Invalid user ID or amount.');
    }
    
    const targetUser = await userService.getUser(userId);
    if (!targetUser) {
      return ctx.reply('❌ User not found.');
    }
    
    const updatedUser = await bonusService.addBonus(userId, amount, 'play');
    
    await ctx.reply(`✅ *Bonus Added Successfully*

👤 User: ${targetUser.firstName || targetUser.username || userId}
💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
🎁 New Play Balance: ${Number(updatedUser.playWallet).toFixed(2)} ${CURRENCY}`, { parse_mode: 'Markdown' });
    
    // Notify the user
    try {
      await ctx.telegram.sendMessage(userId, `🎁 *Bonus Received!*

You received a bonus of *${amount.toFixed(2)} ${CURRENCY}* in your Play Wallet!

🎰 Go play now!`, { parse_mode: 'Markdown' });
    } catch (err) {
      // User may have blocked the bot
    }
    
  } catch (error) {
    console.error('Error in bonus command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register bonus command
 */
const register = (bot) => {
  bot.command('bonus', bonusCommand);
};

module.exports = { register, bonusCommand };
