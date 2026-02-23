const { SESSION_STATES } = require('../../utils/constants');
const configService = require('../../services/config.service');
const { cancelKeyboard } = require('../../keyboards/main.keyboard');

/**
 * Handle /withdraw command
 */
const withdrawCommand = async (ctx) => {
  try {
    // Set session state
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_WITHDRAW_AMOUNT;
    
    const minWithdraw = await configService.get('min_withdraw', 150);
    const message = await configService.getMessage('msg_withdraw_prompt', {
      minWithdraw,
    }, `🏧 *Withdraw*\n\nEnter the amount to withdraw. Type cancel to stop.\n\n⚠️ ዝቅተኛ: ${minWithdraw} ብር`);
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...cancelKeyboard()
    });
  } catch (error) {
    console.error('Error in withdraw command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register withdraw command
 */
const register = (bot) => {
  bot.command('withdraw', withdrawCommand);
};

module.exports = { register, withdrawCommand };
