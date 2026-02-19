const { Markup } = require('telegraf');
const { DASHBOARD_URL } = require('../config/env');

/**
 * Withdraw bank selection keyboard
 */
const withdrawBankKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📱 Telebirr', 'withdraw_telebirr'),
      Markup.button.callback('🏦 CBE', 'withdraw_cbe')
    ],
    [
      Markup.button.callback('❌ Cancel', 'withdraw_cancel')
    ]
  ]);
};

/**
 * Withdraw confirmation keyboard
 */
const withdrawConfirmKeyboard = (amount) => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Confirm', `withdraw_confirm_${amount}`),
      Markup.button.callback('❌ Cancel', 'withdraw_cancel')
    ]
  ]);
};

/**
 * Admin withdraw notification (no approve/reject buttons — use dashboard)
 */
const adminWithdrawKeyboard = (withdrawId, userId) => {
  const url = `${DASHBOARD_URL}/withdrawals?withdrawId=${encodeURIComponent(withdrawId)}&userId=${encodeURIComponent(userId)}`;
  return Markup.inlineKeyboard([
    [
      Markup.button.url('📊 Open Dashboard', url)
    ]
  ]);
};

module.exports = {
  withdrawBankKeyboard,
  withdrawConfirmKeyboard,
  adminWithdrawKeyboard
};
