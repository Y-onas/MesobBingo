const { SESSION_STATES, CURRENCY } = require('../utils/constants');
const { cancelKeyboard, mainKeyboard } = require('../keyboards/main.keyboard');
const { withdrawBankKeyboard, withdrawConfirmKeyboard } = require('../keyboards/withdraw.keyboard');
const withdrawService = require('../services/withdraw.service');
const userService = require('../services/user.service');

/**
 * Handle withdraw bank selection - Telebirr
 */
const handleWithdrawTelebirr = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.withdrawMethod = 'telebirr';
    ctx.session.state = SESSION_STATES.AWAITING_WITHDRAW_PHONE;
    
    await ctx.answerCbQuery();
    await ctx.editMessageText('📱 *Telebirr Withdrawal*\n\nPlease enter your Telebirr phone number (e.g., 0912345678):', {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in withdraw telebirr:', error);
  }
};

/**
 * Handle withdraw bank selection - CBE
 */
const handleWithdrawCBE = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.withdrawMethod = 'cbe';
    ctx.session.state = SESSION_STATES.AWAITING_WITHDRAW_PHONE;
    
    await ctx.answerCbQuery();
    await ctx.editMessageText('🏦 *CBE Withdrawal*\n\nPlease enter your CBE account number:', {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('Error in withdraw cbe:', error);
  }
};

/**
 * Handle withdraw cancel
 */
const handleWithdrawCancel = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.NONE;
    ctx.session.withdrawAmount = null;
    ctx.session.withdrawMethod = null;
    
    await ctx.answerCbQuery('Cancelled');
    await ctx.editMessageText('❌ Withdrawal cancelled.');
  } catch (error) {
    console.error('Error in withdraw cancel:', error);
  }
};

/**
 * Handle withdraw confirmation
 */
const handleWithdrawConfirm = async (ctx) => {
  try {
    const session = ctx.session || {};
    const amount = session.withdrawAmount;
    const method = session.withdrawMethod;
    const accountNumber = session.accountNumber;
    
    if (!amount || !method || !accountNumber) {
      return ctx.answerCbQuery('Session expired. Please start over.');
    }
    
    const withdrawal = await withdrawService.createWithdrawal(
      ctx.from.id,
      amount,
      method,
      accountNumber
    );
    
    // Reset session
    ctx.session.state = SESSION_STATES.NONE;
    ctx.session.withdrawAmount = null;
    ctx.session.withdrawMethod = null;
    ctx.session.accountNumber = null;
    
    await ctx.answerCbQuery('Request submitted!');
    await ctx.editMessageText(`✅ *Withdrawal Request Submitted*

💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📞 Account: ${accountNumber}
📋 Status: Pending

Your withdrawal will be processed soon.`, { parse_mode: 'Markdown' });
    
    // Notify admins
    const { ADMIN_IDS } = require('../config/env');
    for (const adminId of ADMIN_IDS) {
      try {
        await ctx.telegram.sendMessage(adminId, `🏧 *New Withdrawal Request*

👤 User: ${ctx.from.first_name || ctx.from.id}
🆔 ID: ${ctx.from.id}
💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📞 Account: ${accountNumber}`, { parse_mode: 'Markdown' });
      } catch (err) {
        // Admin may have blocked the bot
      }
    }
  } catch (error) {
    console.error('Error confirming withdrawal:', error);
    await ctx.answerCbQuery('Error: ' + error.message);
  }
};

/**
 * Register withdraw actions
 */
const register = (bot) => {
  bot.action('withdraw_telebirr', handleWithdrawTelebirr);
  bot.action('withdraw_cbe', handleWithdrawCBE);
  bot.action('withdraw_cancel', handleWithdrawCancel);
  bot.action(/^withdraw_confirm_/, handleWithdrawConfirm);
};

module.exports = { register };
