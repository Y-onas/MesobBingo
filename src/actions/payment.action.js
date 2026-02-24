const { SESSION_STATES, CURRENCY } = require('../utils/constants');
const { cancelKeyboard } = require('../keyboards/main.keyboard');
const depositService = require('../services/deposit.service');
const userService = require('../services/user.service');
const configService = require('../services/config.service');
const logger = require('../utils/logger');

/**
 * Handle Telebirr payment selection
 */
const handleTelebirr = async (ctx) => {
  try {
    // Answer callback query early to prevent button hanging
    await ctx.answerCbQuery();
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_DEPOSIT_SMS;
    ctx.session.depositMethod = 'telebirr';
    
    // Get active Telebirr account from payment_accounts table
    const account = await configService.getActiveAccount('telebirr');
    
    if (!account) {
      await ctx.editMessageText('❌ Telebirr deposits are temporarily unavailable. Please contact support or try another payment method.');
      return;
    }
    
    const telebirrNumber = account.accountNumber;
    const telebirrName = account.accountName || 'Mesob Bingo';
    const minDeposit = await configService.get('min_deposit', 50);

    const message = await configService.getMessage('msg_deposit_telebirr', {
      telebirrNumber,
      telebirrName,
      minDeposit,
    }, `📱 *Telebirr Deposit*\n\n1. Transfer money to: ${telebirrNumber}\n   Account Name: ${telebirrName}\n2. Take screenshot after transfer\n3. Send screenshot here\n\n⚠️ Minimum: ${minDeposit} ብር`);
    
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    await ctx.reply('📝 Please paste the Telebirr SMS confirmation message.', cancelKeyboard());
  } catch (error) {
    logger.error('Error in telebirr action:', error);
    try {
      await ctx.answerCbQuery('Error');
    } catch (e) {
      // Ignore if already answered
    }
    await ctx.reply('❌ An error occurred while loading deposit information. Please try again or contact support.');
  }
};

/**
 * Handle CBE payment selection
 */
const handleCBE = async (ctx) => {
  try {
    // Answer callback query early to prevent button hanging
    await ctx.answerCbQuery();
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_DEPOSIT_SMS;
    ctx.session.depositMethod = 'cbe';
    
    // Get active CBE account from payment_accounts table
    const account = await configService.getActiveAccount('cbe');
    
    if (!account) {
      await ctx.editMessageText('❌ CBE deposits are temporarily unavailable. Please contact support or try another payment method.');
      return;
    }
    
    const cbeAccount = account.accountNumber;
    const cbeAccountName = account.accountName || 'Mesob Bingo';
    const minDeposit = await configService.get('min_deposit', 50);

    const message = await configService.getMessage('msg_deposit_cbe', {
      cbeAccount,
      cbeAccountName,
      minDeposit,
    }, `🏦 *CBE Deposit*\n\n1. Deposit to Account: ${cbeAccount}\n   Account Name: ${cbeAccountName}\n2. Copy the SMS you receive\n3. Paste and send the full SMS here\n\n⚠️ Minimum: ${minDeposit} ብር`);
    
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    await ctx.reply('📝 Please paste the CBE SMS confirmation message.', cancelKeyboard());
  } catch (error) {
    logger.error('Error in CBE action:', error);
    try {
      await ctx.answerCbQuery('Error');
    } catch (e) {
      // Ignore if already answered
    }
    await ctx.reply('❌ An error occurred while loading deposit information. Please try again or contact support.');
  }
};

/**
 * Handle deposit cancel
 */
const handleDepositCancel = async (ctx) => {
  try {
    await ctx.answerCbQuery('Cancelled');
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.NONE;
    ctx.session.depositMethod = null;
    
    const msg = await configService.getMessage('msg_deposit_cancelled', {}, '❌ Deposit cancelled.');
    await ctx.editMessageText(msg);
  } catch (error) {
    logger.error('Error in deposit cancel:', error);
    try {
      await ctx.answerCbQuery('Error');
    } catch (e) {
      // Ignore if already answered
    }
  }
};

/**
 * Register payment actions
 */
const register = (bot) => {
  bot.action('deposit_telebirr', handleTelebirr);
  bot.action('deposit_cbe', handleCBE);
  bot.action('deposit_cancel', handleDepositCancel);
};

module.exports = { register };
