const { MESSAGES, CURRENCY } = require('../../utils/constants');
const userService = require('../../services/user.service');

/**
 * Handle /balance command
 */
const balanceCommand = async (ctx) => {
  try {
    const user = await userService.getUser(ctx.from.id);
    
    if (!user) {
      return ctx.reply('Please use /start first.');
    }
    
    const total = Number(user.mainWallet) + Number(user.playWallet);
    
    const message = `💰 *BALANCE SUMMARY* 💰

🏦 Main Wallet: ${Number(user.mainWallet).toFixed(2)} ${CURRENCY}
🎁 Play Wallet: ${Number(user.playWallet).toFixed(2)} ${CURRENCY}
━━━━━━━━━━━━━━━━
💵 Total Balance: ${total.toFixed(2)} ${CURRENCY}`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in balance command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register balance command
 */
const register = (bot) => {
  bot.command('balance', balanceCommand);
};

module.exports = { register, balanceCommand };
