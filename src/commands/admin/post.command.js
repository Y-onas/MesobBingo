const { MESSAGES, SESSION_STATES } = require('../../utils/constants');
const { isAdmin } = require('../../config/admin');
const { broadcastTypeKeyboard } = require('../../keyboards/admin.keyboard');

/**
 * Handle /post command (broadcast)
 */
const postCommand = async (ctx) => {
  try {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply(MESSAGES.ADMIN_ONLY);
    }
    
    await ctx.reply(`📢 *Broadcast Message*

Select who should receive the message:`, {
      parse_mode: 'Markdown',
      ...broadcastTypeKeyboard()
    });
    
  } catch (error) {
    console.error('Error in post command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register post command
 */
const register = (bot) => {
  bot.command('post', postCommand);
};

module.exports = { register, postCommand };
