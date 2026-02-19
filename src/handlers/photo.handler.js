const { SESSION_STATES, CURRENCY } = require('../utils/constants');
const { mainKeyboard } = require('../keyboards/main.keyboard');
const { depositConfirmKeyboard } = require('../keyboards/deposit.keyboard');
const depositService = require('../services/deposit.service');
const { MIN_DEPOSIT, ADMIN_IDS } = require('../config/env');

/**
 * Handle photo messages (deposit screenshots)
 */
const photoHandler = async (ctx) => {
  try {
    const session = ctx.session || {};
    
    // Check if awaiting deposit screenshot
    if (session.state !== SESSION_STATES.AWAITING_DEPOSIT_SCREENSHOT) {
      return; // Ignore photos if not in deposit flow
    }
    
    // Get the largest photo
    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    const fileId = largestPhoto.file_id;
    
    // Ask for amount
    ctx.session.screenshotFileId = fileId;
    ctx.session.state = SESSION_STATES.AWAITING_DEPOSIT_SMS; // Reuse for amount
    
    await ctx.reply(`📸 Screenshot received!

Please enter the deposit amount (e.g., 100 or 500):

⚠️ Minimum deposit: ${MIN_DEPOSIT} ${CURRENCY}`);
    
  } catch (error) {
    console.error('Error in photo handler:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Handle deposit amount after screenshot
 */
const handleDepositAmount = async (ctx, amount) => {
  const session = ctx.session || {};
  const fileId = session.screenshotFileId;
  const method = session.depositMethod || 'telebirr';
  
  // Create deposit request
  const deposit = await depositService.createDeposit(
    ctx.from.id,
    amount,
    method,
    fileId,
    null,
    null // no SMS text when using screenshot
  );
  
  ctx.session.state = SESSION_STATES.NONE;
  ctx.session.screenshotFileId = null;
  ctx.session.depositMethod = null;
  
  await ctx.reply(`✅ *Deposit Request Submitted*

💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📋 Status: Pending

Your deposit will be reviewed shortly.`, { 
    parse_mode: 'Markdown',
    ...mainKeyboard()
  });
  
  // Forward to admins
  for (const adminId of ADMIN_IDS) {
    try {
      await ctx.telegram.sendPhoto(adminId, fileId, {
        caption: `💳 *New ${method.toUpperCase()} Deposit*

👤 User: ${ctx.from.first_name || ctx.from.id}
🆔 ID: ${ctx.from.id}
💰 Amount: ${amount.toFixed(2)} ${CURRENCY}`,
        parse_mode: 'Markdown',
        ...depositConfirmKeyboard(String(deposit.id), ctx.from.id)
      });
    } catch (err) {
      // Admin may have blocked the bot
    }
  }
};

/**
 * Register photo handler
 */
const register = (bot) => {
  bot.on('photo', photoHandler);
};

module.exports = { register, handleDepositAmount };
