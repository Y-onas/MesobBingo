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
    
    const message = `🤝 *Invite Friends & Earn Bonus!*
🚀

Share your personal link:
\`${referralLink}\`

*How it works:*
💰 You earn a bonus when your referral makes their *FIRST deposit*:

📊 *Bonus Tiers:*
• 50-99 ${CURRENCY} deposit → You get 5 ${CURRENCY}
• 100-199 ${CURRENCY} deposit → You get 10 ${CURRENCY}
• 200-499 ${CURRENCY} deposit → You get 20 ${CURRENCY}
• 500+ ${CURRENCY} deposit → You get 30 ${CURRENCY}

⚠️ Minimum deposit: 50 ${CURRENCY} to qualify

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
