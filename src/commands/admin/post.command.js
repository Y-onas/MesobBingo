const { SESSION_STATES } = require('../../utils/constants');
const { isAdmin } = require('../../config/admin');
const { broadcastTypeKeyboard } = require('../../keyboards/admin.keyboard');
const configService = require('../../services/config.service');

/**
 * Handle /post command (broadcast)
 */
const postCommand = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      const msg = await configService.getMessage('msg_admin_only', {}, '⚠️ This command is for admins only.');
      return ctx.reply(msg);
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
