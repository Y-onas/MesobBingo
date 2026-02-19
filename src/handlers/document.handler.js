/**
 * Handle document uploads
 */
const documentHandler = async (ctx) => {
  try {
    // For now, just acknowledge document receipt
    // Can be used for additional proof of payment
    await ctx.reply('📄 Document received. If this is a payment proof, please also send a screenshot or the SMS confirmation message.');
  } catch (error) {
    console.error('Error in document handler:', error);
  }
};

/**
 * Register document handler
 */
const register = (bot) => {
  bot.on('document', documentHandler);
};

module.exports = { register };
