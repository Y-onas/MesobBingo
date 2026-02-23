const { SESSION_STATES, CURRENCY, EMOJI } = require('../utils/constants');
const { mainKeyboard } = require('../keyboards/main.keyboard');
const { withdrawBankKeyboard, withdrawConfirmKeyboard } = require('../keyboards/withdraw.keyboard');
const { parseAmount, isValidPhone } = require('../utils/helpers');
const configService = require('../services/config.service');
const depositService = require('../services/deposit.service');
const withdrawService = require('../services/withdraw.service');
const adminService = require('../services/admin.service');
const userService = require('../services/user.service');
const { isAdmin } = require('../config/admin');
const { depositConfirmKeyboard } = require('../keyboards/deposit.keyboard');
const { adminPanelKeyboard } = require('../keyboards/admin.keyboard');
const { depositCommand } = require('../commands/user/deposit.command');
const { withdrawCommand } = require('../commands/user/withdraw.command');
const { balanceCommand } = require('../commands/user/balance.command');
const { inviteCommand } = require('../commands/user/invite.command');
const { helpCommand } = require('../commands/user/help.command');
const { playCommand } = require('../commands/user/play.command');
const { startCommand } = require('../commands/user/start.command');

/**
 * Handle text messages
 */
const textHandler = async (ctx) => {
  try {
    const text = ctx.message.text;
    const session = ctx.session || {};
    
    // Handle cancel
    if (text === '❌ Cancel' || text.toLowerCase() === 'cancel') {
      ctx.session = ctx.session || {};
      ctx.session.state = SESSION_STATES.NONE;
      return ctx.reply('❌ Cancelled.', mainKeyboard());
    }
    
    // Handle back to menu
    if (text === '🔙 Back to Menu') {
      ctx.session = ctx.session || {};
      ctx.session.state = SESSION_STATES.NONE;
      return startCommand(ctx);
    }
    
    // Handle menu buttons
    if (text === `${EMOJI.PLAY} Play`) {
      return playCommand(ctx);
    }
    if (text === `${EMOJI.DEPOSIT} Deposit`) {
      return depositCommand(ctx);
    }
    if (text === `${EMOJI.WITHDRAW} Withdraw`) {
      return withdrawCommand(ctx);
    }
    if (text === `${EMOJI.BALANCE} Check Balance`) {
      return balanceCommand(ctx);
    }
    if (text === `${EMOJI.INVITE} Invite`) {
      return inviteCommand(ctx);
    }
    if (text === `${EMOJI.HELP} How To Play`) {
      return helpCommand(ctx);
    }
    if (text === `${EMOJI.CONTACT} Contact Us`) {
      const supportUsername = await configService.get('support_username', '@mesobbingosupport');
      return ctx.reply(`🏪 *Contact Us*\n\nSupport: ${supportUsername}`, { parse_mode: 'Markdown' });
    }
    if (text === `${EMOJI.JOIN} Join Us`) {
      const channelUrl = await configService.get('channel_url', 'https://t.me/mesob_bingo_official');
      return ctx.reply(`👥 *Join Us*\n\nJoin our channel: ${channelUrl}`, { parse_mode: 'Markdown' });
    }
    if (text === `${EMOJI.TRANSFER} Transfer`) {
      if (await isAdmin(ctx.from.id)) {
        return ctx.reply('Use /transfer [userId] [amount] to transfer funds.');
      }
      return ctx.reply('🎁 Transfers are handled by admin. Contact support.');
    }
    if (text === `${EMOJI.ADMIN} Admin Panel`) {
      if (!await isAdmin(ctx.from.id)) {
        return ctx.reply('⚠️ Admin only.');
      }
      return ctx.reply('👨‍💼 *Admin Panel*', { 
        parse_mode: 'Markdown', 
        ...adminPanelKeyboard() 
      });
    }
    
    // Handle session states
    switch (session.state) {
      case SESSION_STATES.AWAITING_WITHDRAW_AMOUNT:
        return handleWithdrawAmount(ctx, text);
      
      case SESSION_STATES.AWAITING_WITHDRAW_PHONE:
        return handleWithdrawPhone(ctx, text);
      
      case SESSION_STATES.AWAITING_WITHDRAW_ACCOUNT_NAME:
        return handleWithdrawAccountName(ctx, text);
      
      case SESSION_STATES.AWAITING_DEPOSIT_SMS:
        return handleDepositSMS(ctx, text);
      
      case SESSION_STATES.AWAITING_BROADCAST_MESSAGE:
        return handleBroadcastMessage(ctx, text);
      
      default:
        // No active session, ignore or show help
        break;
    }
  } catch (error) {
    console.error('Error in text handler:', error);
  }
};

/**
 * Handle withdraw amount input
 */
const handleWithdrawAmount = async (ctx, text) => {
  const amount = parseAmount(text);
  const MIN_WITHDRAW = await configService.get('min_withdraw', 150);
  
  if (!amount || amount < MIN_WITHDRAW) {
    return ctx.reply(`❌ Invalid amount. Minimum withdrawal is ${MIN_WITHDRAW} ${CURRENCY}.`);
  }
  
  const user = await userService.getUser(ctx.from.id);
  if (!user || Number(user.mainWallet) < amount) {
    return ctx.reply(`❌ Insufficient balance. Your main wallet: ${Number(user?.mainWallet || 0).toFixed(2)} ${CURRENCY}`);
  }
  
  ctx.session.withdrawAmount = amount;
  
  await ctx.reply(`🏧 *Withdrawal: ${amount.toFixed(2)} ${CURRENCY}*

Select withdrawal method:`, {
    parse_mode: 'Markdown',
    ...withdrawBankKeyboard()
  });
};

/**
 * Handle withdraw phone/account input
 */
const handleWithdrawPhone = async (ctx, text) => {
  const accountNumber = text.trim();
  
  if (!accountNumber || accountNumber.length < 8) {
    return ctx.reply('❌ Invalid account number. Please try again.');
  }
  
  ctx.session.accountNumber = accountNumber;
  ctx.session.state = SESSION_STATES.AWAITING_WITHDRAW_ACCOUNT_NAME;
  
  const { cancelKeyboard } = require('../keyboards/main.keyboard');
  
  await ctx.reply(`👤 *Account Holder Name*

Please enter the FULL NAME of the account holder.

This must match the name on your ${ctx.session.withdrawMethod.toUpperCase()} account.

Example: John Doe`, {
    parse_mode: 'Markdown',
    ...cancelKeyboard()
  });
};

/**
 * Handle withdraw account holder name input
 */
const handleWithdrawAccountName = async (ctx, text) => {
  const accountHolderName = text.trim();
  
  // Validation
  if (!accountHolderName || accountHolderName.length < 3) {
    return ctx.reply('❌ Name too short. Please enter your full name (minimum 3 characters).');
  }
  
  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  if (!/^[a-zA-Z\s\-']+$/.test(accountHolderName)) {
    return ctx.reply('❌ Invalid name format. Please use only letters, spaces, hyphens, and apostrophes.\n\nExample: John Doe');
  }
  
  ctx.session.accountHolderName = accountHolderName;
  
  const amount = ctx.session.withdrawAmount;
  const method = ctx.session.withdrawMethod;
  const accountNumber = ctx.session.accountNumber;
  
  await ctx.reply(`📋 *Confirm Withdrawal*

💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📞 Account: ${accountNumber}
👤 Name: ${accountHolderName}

Please confirm your withdrawal:`, {
    parse_mode: 'Markdown',
    ...withdrawConfirmKeyboard(amount)
  });
};

/**
 * Handle deposit SMS (CBE/Telebirr)
 */
const handleDepositSMS = async (ctx, text) => {
  const smsText = text.trim();
  const method = ctx.session.depositMethod || 'cbe';
  
  // Parse amount from SMS - handle both CBE and Telebirr formats
  // CBE: "debited with ETB880.00" or "ETB 880.00" or "ETB2,950.00" (with commas)
  // Telebirr: "You have transferred ETB 593.00"
  // Handle numbers with commas (e.g., 2,950.00)
  const amountMatch = smsText.match(/ETB\s*([\d,]+(?:\.\d{2})?)|debited with ETB\s*([\d,]+(?:\.\d{2})?)|transferred ETB\s*([\d,]+(?:\.\d{2})?)|([\d,]+(?:\.\d{2})?)\s*ETB/i);
  const amountStr = amountMatch ? (amountMatch[1] || amountMatch[2] || amountMatch[3] || amountMatch[4]) : null;
  const amount = amountStr ? parseFloat(amountStr.replace(/,/g, '')) : null;
  
  const MIN_DEPOSIT = await configService.get('min_deposit', 50);

  if (!amount || amount < MIN_DEPOSIT) {
    return ctx.reply(`❌ Could not parse deposit amount from SMS. 

Please make sure your SMS contains the amount in format like:
• "ETB 593.00" (Telebirr)
• "debited with ETB 880.00" (CBE)

Minimum deposit is ${MIN_DEPOSIT} ${CURRENCY}.

Try again or contact support.`, mainKeyboard());
  }
  
  // Create deposit request with SMS text
  const deposit = await depositService.createDeposit(
    ctx.from.id,
    amount,
    method,
    null, // no screenshot
    null, // no transaction ref yet
    smsText // store the full SMS text
  );
  
  ctx.session.state = SESSION_STATES.NONE;
  ctx.session.depositMethod = null;
  
  await ctx.reply(`✅ *Deposit Request Submitted*

💰 Amount: ${amount.toFixed(2)} ${CURRENCY}
📱 Method: ${method.toUpperCase()}
📋 Status: Pending

Your deposit will be reviewed shortly.`, { 
    parse_mode: 'Markdown',
    ...mainKeyboard()
  });
  
  // Notify admins with SMS text
  const { getAllAdmins } = require('../config/admin');
  const allAdmins = await getAllAdmins();
  const activeAdmins = allAdmins.filter(a => a.isActive);
  for (const admin of activeAdmins) {
    try {
      await ctx.telegram.sendMessage(admin.telegramId, `💳 *New ${method.toUpperCase()} Deposit*

👤 User: ${ctx.from.first_name || ctx.from.id}
🆔 ID: ${ctx.from.id}
💰 Amount: ${amount.toFixed(2)} ${CURRENCY}

📱 SMS Message:
${smsText.substring(0, 400)}`, {
        parse_mode: 'Markdown',
        ...depositConfirmKeyboard(String(deposit.id), ctx.from.id)
      });
    } catch (err) {
      // Admin may have blocked the bot
      console.error(`Failed to notify admin ${admin.telegramId}:`, err.message);
    }
  }
};

/**
 * Handle broadcast message
 */
const handleBroadcastMessage = async (ctx, text) => {
  if (!await isAdmin(ctx.from.id)) {
    return;
  }
  
  const broadcastType = ctx.session.broadcastType;
  ctx.session.state = SESSION_STATES.NONE;
  
  // Store the message for later use
  ctx.session.broadcastMessage = text;
  
  const { broadcastActionsKeyboard } = require('../keyboards/admin.keyboard');
  
  await ctx.reply(`✅ *Message Received*

Now choose what to add to your broadcast:

• Add interactive buttons (Play, Deposit, etc.)
• Or send without buttons

Your message:
${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`, {
    parse_mode: 'Markdown',
    ...broadcastActionsKeyboard()
  });
};

/**
 * Register text handler
 */
const register = (bot) => {
  bot.on('text', textHandler);
};

module.exports = { register, textHandler };
