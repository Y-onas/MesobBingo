const { MESSAGES, EMOJI } = require('../../utils/constants');
const { playModeKeyboard, stakeKeyboard } = require('../../keyboards/game.keyboard');
const gameService = require('../../services/game.service');
const userService = require('../../services/user.service');

/**
 * Handle /play command
 */
const playCommand = async (ctx) => {
  try {
    const user = await userService.getUser(ctx.from.id);
    if (!user) {
      return ctx.reply('Please use /start first.');
    }
    
    const totalBalance = Number(user.mainWallet) + Number(user.playWallet);
    
    if (totalBalance < 5) {
      return ctx.reply(`❌ *Insufficient Balance*

Your current balance: ${totalBalance.toFixed(2)} ብር
Minimum stake: 5 ብር

Please deposit funds first.`, { parse_mode: 'Markdown' });
    }
    
    // Construct Web App URL
    const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3001/game';
    console.log('Using Web App URL:', webAppUrl);
    
    await ctx.reply(`🎰 *Ready to Play Bingo!*\n\nClick the button below to start playing:`, {
      parse_mode: 'Markdown',
      ...playModeKeyboard(webAppUrl)
    });
    
  } catch (error) {
    console.error('Error in play command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register play command
 */
const register = (bot) => {
  bot.command('play', playCommand);
};

module.exports = { register, playCommand };
