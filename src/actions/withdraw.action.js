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
    const accountHolderName = session.accountHolderName;
    
    if (!amount || !method || !accountNumber || !accountHolderName) {
      return ctx.answerCbQuery('Session expired. Please start over.');
    }
    
    try {
      const withdrawal = await withdrawService.createWithdrawal(
        ctx.from.id,
        amount,
        method,
        accountNumber,
        accountHolderName
      );
      
      // Reset session
      ctx.session.state = SESSION_STATES.NONE;
      ctx.session.withdrawAmount = null;
      ctx.session.withdrawMethod = null;
      ctx.session.accountNumber = null;
      ctx.session.accountHolderName = null;
      
      await ctx.answerCbQuery('Request submitted!');
      await ctx.editMessageText(`✅ *Withdrawal Request Submitted*

💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📞 Account: ${accountNumber}
👤 Name: ${accountHolderName}
📋 Status: Pending

Your withdrawal will be processed soon.`, { parse_mode: 'Markdown' });
      
      // Notify admins (from DB)
      const { getAllAdmins } = require('../config/admin');
      const allAdmins = await getAllAdmins();
      const activeAdmins = allAdmins.filter(a => a.isActive);
      for (const admin of activeAdmins) {
        try {
          await ctx.telegram.sendMessage(admin.telegramId, `🏧 *New Withdrawal Request*

👤 User: ${ctx.from.first_name || ctx.from.id}
🆔 ID: ${ctx.from.id}
💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📞 Account: ${accountNumber}
👤 Account Holder: ${accountHolderName}`, { parse_mode: 'Markdown' });
        } catch (err) {
          // Admin may have blocked the bot
        }
      }
    } catch (error) {
      // Handle insufficient withdrawable balance error
      if (error.message === 'INSUFFICIENT_WITHDRAWABLE_BALANCE') {
        const withdrawable = error.withdrawableBalance.toFixed(2);
        const playing = error.playingBalance.toFixed(2);
        
        await ctx.answerCbQuery('Insufficient withdrawable balance');
        await ctx.editMessageText(`❌ *Insufficient Withdrawable Balance*

Your withdrawable balance: *${withdrawable} ${CURRENCY}*
You need to play and win more before withdrawing.

Your playing balance: *${playing} ${CURRENCY}*
(This money must be played first)

💡 *Tip:* Only winnings can be withdrawn. Deposits and bonuses must be played in games first.`, { parse_mode: 'Markdown' });
      } else {
        throw error;
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
