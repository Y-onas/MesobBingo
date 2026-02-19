const { MESSAGES, CURRENCY } = require('../../utils/constants');
const { isAdmin } = require('../../config/admin');
const adminService = require('../../services/admin.service');

/**
 * Handle /users command
 */
const usersCommand = async (ctx) => {
  try {
    if (!isAdmin(ctx.from.id)) {
      return ctx.reply(MESSAGES.ADMIN_ONLY);
    }
    
    const stats = await adminService.getStats();
    
    const message = `📊 *Bot Statistics*

👥 *Users:*
• Total Users: ${stats.totalUsers}
• Active (24h): ${stats.activeUsers}
• Depositors: ${stats.depositors}

💰 *Financials:*
• Total Deposited: ${stats.totalDeposited.toFixed(2)} ${CURRENCY}
• Total Withdrawn: ${stats.totalWithdrawn.toFixed(2)} ${CURRENCY}
• Net: ${(stats.totalDeposited - stats.totalWithdrawn).toFixed(2)} ${CURRENCY}

📋 *Pending:*
• Pending Deposits: ${stats.pendingDeposits}`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    
  } catch (error) {
    console.error('Error in users command:', error);
    await ctx.reply('❌ An error occurred. Please try again.');
  }
};

/**
 * Register users command
 */
const register = (bot) => {
  bot.command('users', usersCommand);
};

module.exports = { register, usersCommand };
