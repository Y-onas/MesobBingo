const { CURRENCY, SESSION_STATES } = require('../utils/constants');
const { isAdmin } = require('../config/admin');
const { adminPanelKeyboard } = require('../keyboards/admin.keyboard');
const { mainKeyboard } = require('../keyboards/main.keyboard');
const adminService = require('../services/admin.service');
const depositService = require('../services/deposit.service');

/**
 * Handle admin stats
 */
const handleAdminStats = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    const stats = await adminService.getStats();
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📊 *Bot Statistics*

👥 *Users:*
• Total Users: ${stats.totalUsers}
• Active (24h): ${stats.activeUsers}
• Depositors: ${stats.depositors}

💰 *Financials:*
• Total Deposited: ${stats.totalDeposited.toFixed(2)} ${CURRENCY}
• Total Withdrawn: ${stats.totalWithdrawn.toFixed(2)} ${CURRENCY}
• Net: ${(stats.totalDeposited - stats.totalWithdrawn).toFixed(2)} ${CURRENCY}

📋 *Pending:*
• Pending Deposits: ${stats.pendingDeposits}`, {
      parse_mode: 'Markdown',
      ...adminPanelKeyboard()
    });
  } catch (error) {
    console.error('Error in admin stats:', error);
  }
};

/**
 * Handle admin pending deposits
 */
const handlePendingDeposits = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    const deposits = await depositService.getPendingDeposits();
    
    await ctx.answerCbQuery();
    
    if (deposits.length === 0) {
      return ctx.editMessageText('✅ No pending deposits.', adminPanelKeyboard());
    }
    
    await ctx.editMessageText(`📋 *Pending Deposits: ${deposits.length}*

Showing most recent deposits...`, { parse_mode: 'Markdown' });
    
    // Send each deposit as a separate message (max 5)
    const toShow = deposits.slice(0, 5);
    for (const deposit of toShow) {
      const { depositConfirmKeyboard } = require('../keyboards/deposit.keyboard');
      await ctx.reply(`💳 *Deposit Request*

🆔 User ID: ${deposit.telegramId}
💰 Amount: ${Number(deposit.amount).toFixed(2)} ${CURRENCY}
📱 Method: ${deposit.method.toUpperCase()}
📅 ${deposit.createdAt.toLocaleString()}`, {
        parse_mode: 'Markdown',
        ...depositConfirmKeyboard(String(deposit.id), deposit.telegramId)
      });
    }
  } catch (error) {
    console.error('Error in pending deposits:', error);
  }
};

/**
 * Handle broadcast type selection
 */
const handleBroadcastAll = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_BROADCAST_MESSAGE;
    ctx.session.broadcastType = 'all';
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📢 *Broadcast to All Users*

Reply with the message you want to send to all users.

You can add interactive buttons in the next step.

Type 'cancel' to cancel.`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in broadcast all:', error);
  }
};

/**
 * Handle broadcast to depositors only
 */
const handleBroadcastDepositors = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_BROADCAST_MESSAGE;
    ctx.session.broadcastType = 'depositors';
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📢 *Broadcast to Depositors Only*

Reply with the message you want to send to depositors.

You can add interactive buttons in the next step.

Type 'cancel' to cancel.`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in broadcast depositors:', error);
  }
};

/**
 * Handle admin back to menu
 */
const handleAdminBack = async (ctx) => {
  try {
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.NONE;
    
    await ctx.answerCbQuery();
    await ctx.deleteMessage();
    await ctx.reply('🔙 Back to main menu', mainKeyboard());
  } catch (error) {
    console.error('Error in admin back:', error);
  }
};

/**
 * Register admin actions
 */
const register = (bot) => {
  bot.action('admin_stats', handleAdminStats);
  bot.action('admin_pending_deposits', handlePendingDeposits);
  bot.action('broadcast_all', handleBroadcastAll);
  bot.action('broadcast_depositors', handleBroadcastDepositors);
  bot.action('admin_back', handleAdminBack);
  bot.action('admin_users', handleAdminStats); // Reuse stats for now
  bot.action('admin_pending_withdrawals', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return ctx.answerCbQuery('Unauthorized');
    await ctx.answerCbQuery('Coming soon...');
  });
  bot.action('admin_broadcast', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return ctx.answerCbQuery('Unauthorized');
    const { broadcastTypeKeyboard } = require('../keyboards/admin.keyboard');
    await ctx.answerCbQuery();
    await ctx.editMessageText('📢 Select broadcast type:', broadcastTypeKeyboard());
  });
  bot.action('admin_add_bonus', async (ctx) => {
    if (!await isAdmin(ctx.from.id)) return ctx.answerCbQuery('Unauthorized');
    await ctx.answerCbQuery();
    await ctx.reply('Use /bonus [userId] [amount] to add bonus.');
  });
  
  // Broadcast action buttons
  bot.action('broadcast_add_play', handleBroadcastAddButton('play'));
  bot.action('broadcast_add_deposit', handleBroadcastAddButton('deposit'));
  bot.action('broadcast_add_balance', handleBroadcastAddButton('balance'));
  bot.action('broadcast_add_invite', handleBroadcastAddButton('invite'));
  bot.action('broadcast_send_plain', handleBroadcastSendPlain);
};

/**
 * Handle adding button to broadcast
 */
const handleBroadcastAddButton = (buttonType) => async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    ctx.session = ctx.session || {};
    ctx.session.broadcastButton = buttonType;
    
    await ctx.answerCbQuery();
    await ctx.reply('📢 Broadcasting message with button...');
    
    const { Markup } = require('telegraf');
    const { EMOJI } = require('../utils/constants');
    const configService = require('../services/config.service');
    
    // Get bot username from dynamic config
    const botUsername = await configService.get('bot_username', 'your_bot_username');
    
    // Create button based on type
    let buttonText, buttonUrl;
    
    switch (buttonType) {
      case 'play':
        buttonText = `${EMOJI.PLAY} Play`;
        buttonUrl = `https://t.me/${botUsername}?start=play`;
        break;
      case 'deposit':
        buttonText = `${EMOJI.DEPOSIT} Deposit`;
        buttonUrl = `https://t.me/${botUsername}?start=deposit`;
        break;
      case 'balance':
        buttonText = `${EMOJI.BALANCE} Check Balance`;
        buttonUrl = `https://t.me/${botUsername}?start=balance`;
        break;
      case 'invite':
        buttonText = `${EMOJI.INVITE} Invite Friends`;
        buttonUrl = `https://t.me/${botUsername}?start=invite`;
        break;
      default:
        buttonText = 'Open Bot';
        buttonUrl = `https://t.me/${botUsername}`;
    }
    
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.url(buttonText, buttonUrl)]
    ]);
    
    if (!ctx.session?.broadcastMessage) {
      return ctx.reply('❌ Broadcast message not found. Please start the broadcast flow again.');
    }
    
    const result = await adminService.broadcastMessage(
      ctx,
      ctx.session.broadcastMessage,
      ctx.session.broadcastType === 'depositors',
      keyboard
    );
    
    ctx.session.broadcastMessage = null;
    ctx.session.broadcastButton = null;
    
    await ctx.reply(`✅ *Broadcast Complete*

✅ Sent: ${result.success}
❌ Failed: ${result.failed}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in broadcast add button:', error);
  }
};

/**
 * Handle sending broadcast without buttons
 */
const handleBroadcastSendPlain = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    await ctx.answerCbQuery();
    
    if (!ctx.session?.broadcastMessage) {
      return ctx.reply('❌ Broadcast message not found. Please start the broadcast flow again.');
    }
    
    await ctx.reply('📢 Broadcasting message...');
    
    const result = await adminService.broadcastMessage(
      ctx,
      ctx.session.broadcastMessage,
      ctx.session.broadcastType === 'depositors'
    );
    
    ctx.session.broadcastMessage = null;
    
    await ctx.reply(`✅ *Broadcast Complete*

✅ Sent: ${result.success}
❌ Failed: ${result.failed}`, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error in broadcast send plain:', error);
  }
};

module.exports = { register };
