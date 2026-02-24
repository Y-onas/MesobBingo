const { CURRENCY } = require('../../utils/constants');
const { isAdmin } = require('../../config/admin');
const bonusService = require('../../services/bonus.service');
const userService = require('../../services/user.service');
const { parseAmount } = require('../../utils/helpers');
const configService = require('../../services/config.service');

/**
 * Handle /transfer command
 */
const transferCommand = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      const msg = await configService.getMessage('msg_admin_only', {}, '⚠️ This command is for admins only.');
      return ctx.reply(msg);
    }
    
    const args = ctx.message.text.split(' ').slice(1);
    
    if (args.length < 2) {
      return ctx.reply(`🎁 *Transfer Funds*

*Usage:* \`/transfer [userId] [amount]\`
*Example:* \`/transfer 123456789 100\`

Transfer funds to a user's main wallet.`, { parse_mode: 'Markdown' });
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
    
    // Admin transfers go to main wallet
    const updatedUser = await bonusService.addBonus(userId, amount, 'main');
    
    await ctx.reply(`✅ *Transfer Successful*

👤 User: ${targetUser.firstName || targetUser.username || userId}
💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
🏦 New Main Balance: ${Number(updatedUser.mainWallet).toFixed(2)} ${CURRENCY}`, { parse_mode: 'Markdown' });
    
    // Notify the user
    try {
      await ctx.telegram.sendMessage(userId, `💰 *Funds Received!*

You received *${amount.toFixed(2)} ${CURRENCY}* in your Main Wallet!`, { parse_mode: 'Markdown' });
    } catch (err) {
      // User may have blocked the bot
    }
    
  } catch (error) {
    console.error('Error in transfer command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register transfer command
 */
const register = (bot) => {
  bot.command('transfer', transferCommand);
};

module.exports = { register, transferCommand };
