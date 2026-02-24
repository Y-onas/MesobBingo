const { Markup } = require('telegraf');
const { CURRENCY } = require('../../utils/constants');
const configService = require('../../services/config.service');
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
    
    // Get bot username from dynamic config and normalize it
    let botUsername = await configService.get('bot_username', 'your_bot_username');
    
    // Normalize: trim whitespace and remove leading '@' if present
    if (botUsername) {
      botUsername = botUsername.trim().replace(/^@/, '');
    }
    
    const referralLink = `https://t.me/${botUsername}?start=ref_${ctx.from.id}`;
    
    // Get dynamic referral tiers from DB
    const tiers = await configService.getReferralTiers();
    const minDeposit = await configService.get('min_deposit', 50);

    let tierText = '';
    if (tiers.length > 0) {
      tierText = tiers.map(t => {
        const min = Number(t.minDeposit).toFixed(0);
        const max = t.maxDeposit ? Number(t.maxDeposit).toFixed(0) : '+';
        const bonus = Number(t.bonusAmount).toFixed(0);
        return `   💎 ${min}-${max} ${CURRENCY} → *${bonus} ${CURRENCY}* ቦነስ`;
      }).join('\n');
    } else {
      tierText = `   💎 50-99 ${CURRENCY} → *10 ${CURRENCY}* ቦነስ
   💎 100-199 ${CURRENCY} → *15 ${CURRENCY}* ቦነስ
   💎 200-499 ${CURRENCY} → *20 ${CURRENCY}* ቦነስ
   💎 500+ ${CURRENCY} → *30 ${CURRENCY}* ቦነስ`;
    }

    const message = `🤝 *ጓደኞችዎን ይጋብዙ — ቦነስ ያግኙ!* 🚀

━━━━━━━━━━━━━━━━
🔗 *የእርስዎ ሊንክ:*
\`${referralLink}\`

━━━━━━━━━━━━━━━━
📖 *እንዴት ይሰራል:*

1️⃣ ሊንክዎን ለጓደኛዎ ያጋሩ
2️⃣ ጓደኛዎ Mesob Bingo ይቀላቀላል
3️⃣ ጓደኛዎ የመጀመሪያ ዲፖዚት ሲያደርግ — 
   *እርስዎ ቦነስ ያገኛሉ!* 🎁

━━━━━━━━━━━━━━━━
📊 *ቦነስ ደረጃዎች:*
${tierText}

⚠️ ዝቅተኛ ዲፖዚት: ${minDeposit} ${CURRENCY}

━━━━━━━━━━━━━━━━
📈 *የእርስዎ ውጤት:*
👥 ጠቅላላ ሪፈራሎች: *${user.referralCount}*
💰 ጠቅላላ ገቢ: *${Number(user.referralEarnings).toFixed(2)} ${CURRENCY}*`;
    
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [
          Markup.button.url('🔗 ሊንክ ክፈት', referralLink),
          Markup.button.switchToChat('📤 ለጓደኛ ላክ', `Mesob Bingo ተቀላቀል! 🎰\n${referralLink}`)
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
