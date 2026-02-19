const { MESSAGES, EMOJI } = require('../../utils/constants');
const { paymentMethodKeyboard } = require('../../keyboards/deposit.keyboard');

/**
 * Handle /deposit command
 */
const depositCommand = async (ctx) => {
  try {
    await ctx.reply(MESSAGES.DEPOSIT_INSTRUCTIONS, {
      parse_mode: 'Markdown',
      ...paymentMethodKeyboard()
    });
  } catch (error) {
    console.error('Error in deposit command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register deposit command
 */
const register = (bot) => {
  bot.command('deposit', depositCommand);
};

module.exports = { register, depositCommand };
