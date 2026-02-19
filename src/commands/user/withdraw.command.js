const { MESSAGES, SESSION_STATES } = require('../../utils/constants');
const { MIN_WITHDRAW } = require('../../config/env');
const { cancelKeyboard } = require('../../keyboards/main.keyboard');

/**
 * Handle /withdraw command
 */
const withdrawCommand = async (ctx) => {
  try {
    // Set session state
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_WITHDRAW_AMOUNT;
    
    const message = MESSAGES.WITHDRAW_PROMPT.replace('{minWithdraw}', MIN_WITHDRAW);
    
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
