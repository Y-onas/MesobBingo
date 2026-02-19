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
    if (!isAdmin(ctx.from.id)) {
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
    if (!isAdmin(ctx.from.id)) {
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
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_BROADCAST_MESSAGE;
    ctx.session.broadcastType = 'all';
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📢 *Broadcast to All Users*

Reply with the message you want to send to all users.

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
    if (!isAdmin(ctx.from.id)) {
      return ctx.answerCbQuery('Unauthorized');
    }
    
    ctx.session = ctx.session || {};
    ctx.session.state = SESSION_STATES.AWAITING_BROADCAST_MESSAGE;
    ctx.session.broadcastType = 'depositors';
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`📢 *Broadcast to Depositors Only*

Reply with the message you want to send to depositors.

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
    await ctx.answerCbQuery('Coming soon...');
  });
  bot.action('admin_broadcast', async (ctx) => {
    const { broadcastTypeKeyboard } = require('../keyboards/admin.keyboard');
    await ctx.answerCbQuery();
    await ctx.editMessageText('📢 Select broadcast type:', broadcastTypeKeyboard());
  });
  bot.action('admin_add_bonus', async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply('Use /bonus [userId] [amount] to add bonus.');
  });
};

module.exports = { register };
