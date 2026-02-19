const { MESSAGES, SESSION_STATES, CURRENCY } = require('../utils/constants');
const { TELEBIRR_NUMBER, CBE_ACCOUNT, MIN_DEPOSIT, ADMIN_IDS } = require('../config/env');
const { cancelKeyboard } = require('../keyboards/main.keyboard');
const depositService = require('../services/deposit.service');
const userService = require('../services/user.service');

/**
 * Handle Telebirr payment selection
 */
const handleTelebirr = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_DEPOSIT_SMS;
    ctx.session.depositMethod = 'telebirr';
    
    const message = MESSAGES.DEPOSIT_TELEBIRR
      .replace('{telebirrNumber}', TELEBIRR_NUMBER)
      .replace('{minDeposit}', MIN_DEPOSIT);
    
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
    
    const message = MESSAGES.DEPOSIT_CBE
      .replace('{cbeAccount}', CBE_ACCOUNT)
      .replace('{minDeposit}', MIN_DEPOSIT);
    
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
    
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Deposit cancelled.');
  } catch (error) {
    console.error('Error in deposit cancel:', error);
  }
};

/**
 * Register payment actions
 * NOTE: Deposit approve/reject now handled via Admin Dashboard only
 */
const register = (bot) => {
  bot.action('deposit_telebirr', handleTelebirr);
  bot.action('deposit_cbe', handleCBE);
  bot.action('deposit_cancel', handleDepositCancel);
  // Approve/reject removed — use dashboard at /deposits
};

module.exports = { register };
