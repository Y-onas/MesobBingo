const { paymentMethodKeyboard } = require('../../keyboards/deposit.keyboard');
const configService = require('../../services/config.service');

/**
 * Handle /deposit command
 */
const depositCommand = async (ctx) => {
  try {
    const message = await configService.getMessage(
      'msg_deposit_instructions', {},
      '💰 *Deposit Instructions*\n\nገንዘብ ለማስገባት ከታች አንዱን የክፍያ ዘዴ ይምረጡ:'
    );

    await ctx.reply(message, {
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
