const { CURRENCY } = require('../../utils/constants');
const configService = require('../../services/config.service');
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
    
    // New balance system
    const withdrawable = Number(user.withdrawableBalance).toFixed(2);
    const playing = Number(user.playingBalance).toFixed(2);
    const total = (Number(user.withdrawableBalance) + Number(user.playingBalance)).toFixed(2);
    
    const message = await configService.getMessage('msg_balance', {
      withdrawable,
      playing,
      total,
    }, `💰 *YOUR BALANCE*

✅ *Withdrawable:* ${withdrawable} ${CURRENCY}
   (Real winnings - can withdraw)

🎮 *Playing Balance:* ${playing} ${CURRENCY}
   (Deposits & bonuses - must play)

━━━━━━━━━━━━━━━━━━━━━━
💵 *Total:* ${total} ${CURRENCY}`);
    
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
