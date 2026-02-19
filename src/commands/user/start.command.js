const { BOT_NAME, EMOJI } = require('../../utils/constants');
const { mainKeyboard, adminKeyboard } = require('../../keyboards/main.keyboard');
const userService = require('../../services/user.service');
const { parseRefCode } = require('../../utils/helpers');
const { isAdmin } = require('../../config/admin');

/**
 * Handle /start command
 */
const startCommand = async (ctx) => {
  try {
    const telegramUser = ctx.from;

    // Check for referral code
    const startPayload = ctx.message.text.split(' ')[1];
    let referrerId = null;

    if (startPayload) {
      referrerId = parseRefCode(startPayload);
      // Don't allow self-referral
      if (referrerId === telegramUser.id) {
        referrerId = null;
      }
    }

    // Create or get user
    const user = await userService.createOrGetUser(telegramUser, referrerId);

    // Check if phone is verified
    if (!user.phoneVerified) {
      // New user or unverified — prompt contact sharing
      const verifyMessage = `🎰 *እንኳን ወደ ${BOT_NAME} በደህና መጡ!* 🎰

👋 ሰላም ${telegramUser.first_name || 'User'}!

📱 *Phone Verification Required*

To start playing and receive your *5 ብር welcome bonus*, please share your contact by tapping the button below 👇`;

      await ctx.reply(verifyMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [{ text: '📱 Share Contact', request_contact: true }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });

      // If referred, let them know
      if (referrerId && user.referredBy === referrerId) {
        await ctx.reply('🤝 You were referred by a friend! Verify your phone to start playing.');
      }

      return;
    }

    // Verified user — show main menu
    const keyboard = isAdmin(telegramUser.id) ? adminKeyboard() : mainKeyboard();

    const welcomeMessage = `🎰 *እንኳን ወደ ${BOT_NAME} በደህና መጡ!* 🎰

👋 ሰላም ${telegramUser.first_name || 'User'}!

💰 *Your Balance:*
🏦 Main Wallet: ${Number(user.mainWallet).toFixed(2)} ብር
🎁 Play Wallet: ${Number(user.playWallet).toFixed(2)} ብር

ለመጫወት ከታች ያለውን ምናሌ ይጠቀሙ:`;

    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
      ...keyboard,
    });

  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register start command
 */
const register = (bot) => {
  bot.start(startCommand);
  bot.command('start', startCommand);
};

module.exports = { register, startCommand };
