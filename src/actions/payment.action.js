const { SESSION_STATES, CURRENCY } = require('../utils/constants');
const { cancelKeyboard } = require('../keyboards/main.keyboard');
const depositService = require('../services/deposit.service');
const userService = require('../services/user.service');
const configService = require('../services/config.service');

/**
 * Handle Telebirr payment selection
 */
const handleTelebirr = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_DEPOSIT_SMS;
    ctx.session.depositMethod = 'telebirr';
    
    // Get active Telebirr account from payment_accounts table
    const account = await configService.getActiveAccount('telebirr');
    const telebirrNumber = account?.accountNumber || '0900000000';
    const telebirrName = account?.accountName || 'Mesob Bingo';
    const minDeposit = await configService.get('min_deposit', 50);

    const message = await configService.getMessage('msg_deposit_telebirr', {
      telebirrNumber,
      telebirrName,
      minDeposit,
    }, `📱 *Telebirr Deposit*\n\n1. Transfer money to: ${telebirrNumber}\n   Account Name: ${telebirrName}\n2. Take screenshot after transfer\n3. Send screenshot here\n\n⚠️ Minimum: ${minDeposit} ብር`);
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    await ctx.reply('📝 Please paste the Telebirr SMS confirmation message.', cancelKeyboard());
  } catch (error) {
    console.error('Error in telebirr action:', error);
  }
};

/**
 * Handle CBE payment selection
 */
const handleCBE = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_DEPOSIT_SMS;
    ctx.session.depositMethod = 'cbe';
    
    // Get active CBE account from payment_accounts table
    const account = await configService.getActiveAccount('cbe');
    const cbeAccount = account?.accountNumber || '1000000000000';
    const cbeAccountName = account?.accountName || 'Mesob Bingo';
    const minDeposit = await configService.get('min_deposit', 50);

    const message = await configService.getMessage('msg_deposit_cbe', {
      cbeAccount,
      cbeAccountName,
      minDeposit,
    }, `🏦 *CBE Deposit*\n\n1. Deposit to Account: ${cbeAccount}\n   Account Name: ${cbeAccountName}\n2. Copy the SMS you receive\n3. Paste and send the full SMS here\n\n⚠️ Minimum: ${minDeposit} ብር`);
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(message, { parse_mode: 'Markdown' });
    await ctx.reply('📝 Please paste the CBE SMS confirmation message.', cancelKeyboard());
  } catch (error) {
    console.error('Error in CBE action:', error);
  }
};

/**
 * Handle deposit cancel
 */
const handleDepositCancel = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.NONE;
    ctx.session.depositMethod = null;
    
    const msg = await configService.getMessage('msg_deposit_cancelled', {}, '❌ Deposit cancelled.');
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText(msg);
  } catch (error) {
    console.error('Error in deposit cancel:', error);
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
