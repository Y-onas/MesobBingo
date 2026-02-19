const { Markup } = require('telegraf');
const { MESSAGES, BOT_USERNAME, CURRENCY, EMOJI } = require('../../utils/constants');
const { REFERRAL_BONUS } = require('../../config/env');
const userService = require('../../services/user.service');

/**
 * Handle /invite command
 */
const inviteCommand = async (ctx) => {
  try {
    const user = await userService.getUser(ctx.from.id);
    
    if (!user) {
      return ctx.reply('Please use /start first.');
    }
    
    const referralLink = `https://t.me/${BOT_USERNAME}?start=ref_${ctx.from.id}`;
    
    const message = `🤝 *Invite Friends & Earn Recurring Income!*
🚀

Share your personal link:
\`${referralLink}\`

*How it works:*
🔄 You get ${EMOJI.MONEY} *${REFERRAL_BONUS} ${CURRENCY} on EVERY deposit* your referral makes!

*Example:*
• If they deposit 5 times → You earn 50 ${CURRENCY}
• If they deposit 10 times → You earn 100 ${CURRENCY}
• No limits! Keep earning forever! 🚀

━━━━━━━━━━━━━━━━
📊 *Your Referral Stats:*
👥 Total Referrals: ${user.referralCount}
💰 Total Earnings: ${user.referralEarnings.toFixed(2)} ${CURRENCY}`;
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.url('🔗 Open Link', referralLink),
          Markup.button.switchToChat('📤 Share', `Join me on Mesob Bingo! 🎰\n${referralLink}`)
        ]
      ])
    });
  } catch (error) {
    console.error('Error in invite command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register invite command
 */
const register = (bot) => {
  bot.command('invite', inviteCommand);
};

module.exports = { register, inviteCommand };
