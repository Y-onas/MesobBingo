const { CURRENCY } = require('../../utils/constants');
const { isAdmin } = require('../../config/admin');
const adminService = require('../../services/admin.service');
const configService = require('../../services/config.service');

/**
 * Handle /users command
 */
const usersCommand = async (ctx) => {
  try {
    if (!await isAdmin(ctx.from.id)) {
      const msg = await configService.getMessage('msg_admin_only', {}, '⚠️ This command is for admins only.');
      return ctx.reply(msg);
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
