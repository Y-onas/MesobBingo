const { Markup } = require('telegraf');
const { EMOJI } = require('../utils/constants');

/**
 * Admin panel main keyboard
 */
const adminPanelKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📊 Stats', 'admin_stats'),
      Markup.button.callback('👥 Users', 'admin_users')
    ],
    [
      Markup.button.callback('💳 Pending Deposits', 'admin_pending_deposits'),
      Markup.button.callback('🏧 Pending Withdrawals', 'admin_pending_withdrawals')
    ],
    [
      Markup.button.callback('📢 Broadcast', 'admin_broadcast'),
      Markup.button.callback('🎁 Add Bonus', 'admin_add_bonus')
    ],
    [
      Markup.button.callback('🔙 Back to Menu', 'admin_back')
    ]
  ]);
};

/**
 * User management keyboard
 */
const userManagementKeyboard = (userId) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('💰 Add Balance', `admin_user_add_${userId}`),
      Markup.button.callback('➖ Remove Balance', `admin_user_remove_${userId}`)
    ],
    [
      Markup.button.callback('🚫 Ban User', `admin_user_ban_${userId}`),
      Markup.button.callback('✅ Unban User', `admin_user_unban_${userId}`)
    ],
    [
      Markup.button.callback('🔙 Back', 'admin_users')
    ]
  ]);
};

/**
 * Broadcast type keyboard
 */
const broadcastTypeKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📢 All Users', 'broadcast_all'),
      Markup.button.callback('💳 Depositors Only', 'broadcast_depositors')
    ],
    [
      Markup.button.callback('❌ Cancel', 'admin_back')
    ]
  ]);
};

module.exports = {
  adminPanelKeyboard,
  userManagementKeyboard,
  broadcastTypeKeyboard
};
