const configService = require('../../services/config.service');
const { CURRENCY } = require('../../utils/constants');

/**
 * Handle /help command
 */
const helpCommand = async (ctx) => {
  try {
    // Get dynamic game stakes
    const defaultStakes = [10, 20, 50, 100, 200];
    const stakes = await configService.get('game_stakes', defaultStakes);
    const stakesDisplay = Array.isArray(stakes) ? stakes.join(', ') : stakes;

    // Get dynamic min deposit
    const minDeposit = await configService.get('min_deposit', 50);

    const message = `📖 *እንዴት እንደሚጫወቱ — Mesob Bingo*

━━━━━━━━━━━━━━━━
💰 *ደረጃ 1: ገንዘብ ያስቀምጡ (Deposit)*
ከመጫወትዎ በፊት ገንዘብ ማስቀመጥ ያስፈልግዎታል።
Telebirr ወይም CBE ይጠቀሙ።
ዝቅተኛ ተቀማጭ: ${minDeposit} ${CURRENCY}

🎮 *ደረጃ 2: 🎰 Play ይንኩ*
ከዋናው ምናሌ Play የሚለውን ይምረጡ።

💵 *ደረጃ 3: Stake ይምረጡ*
${stakesDisplay} ${CURRENCY} ከሚሉት ውስጥ ይምረጡ።

🏠 *ደረጃ 4: Game Room ይቀላቀሉ*
ከሌሎች ተጫዋቾች ጋር የ Game Room ይቀላቀሉ።
ሁሉም ተጫዋቾች ሲገቡ ጨዋታው ይጀምራል!

🎱 *ደረጃ 5: ቁጥሮች ይጠራሉ*
ቁጥሮች በቅደም ተከተል ይጠራሉ — 
ቦርድዎ ላይ ካለ ያድምቁ!

🏆 *ደረጃ 6: BINGO!*
ቦርድዎን ሙሉ ለሙሉ ከሞሉ — እርስዎ አሸናፊ ነዎት! 🎉
ገንዘቡ ወዲያውኑ ወደ ዋሌትዎ ይገባል!

━━━━━━━━━━━━━━━━
🎯 *Winning:*
• ያሸነፉ ገንዘብ ወደ Main Wallet ይገባል
• ማውጣት (Withdraw) Telebirr/CBE ይቻላል
• ጓደኛዎን ይጋብዙ — ተጨማሪ ቦነስ ያግኙ! /invite`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in help command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register help command
 */
const register = (bot) => {
  bot.command('help', helpCommand);
};

module.exports = { register, helpCommand };
