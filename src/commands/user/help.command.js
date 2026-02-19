const { MESSAGES } = require('../../utils/constants');

/**
 * Handle /help command
 */
const helpCommand = async (ctx) => {
  try {
    const message = `📖 *How To Play*

Pick a stake → choose a board → select numbers.

*ደረጃ 1:* ገንዘብ ያስቀምጡ (Deposit)
ከመጫወትዎ በፊት ገንዘብ ማስቀመጥ ያስፈልግዎታል። Telebirr ወይም CBE ይጠቀሙ።

*ደረጃ 2:* 🎰 Play ይንኩ
ከዋናው ምናሌ Play የሚለውን ይምረጡ።

*ደረጃ 3:* Stake ይምረጡ
5, 10, 20, 50, ወይም 100 ብር ይምረጡ።

*ደረጃ 4:* Board ይምረጡ
ከ Board A-E ውስጥ አንዱን ይምረጡ።

*ደረጃ 5:* ቁጥሮችዎን ይምረጡ
ከ 1-90 ውስጥ 5 ቁጥሮች ይምረጡ።

*ደረጃ 6:* Play ይጫኑ!
ካሸነፉ ወዲያውኑ ገንዘቡ ወደ ዋሌትዎ ይገባል!

━━━━━━━━━━━━━━━━
*🎯 Winning Prizes:*
• 3 matches = 2x your stake
• 4 matches = 5x your stake
• 5 matches = 100x JACKPOT! 🎉`;
    
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
