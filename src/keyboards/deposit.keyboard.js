const { Markup } = require('telegraf');
const { EMOJI } = require('../utils/constants');
const { DASHBOARD_URL } = require('../config/env');

/**
 * Payment method selection inline keyboard
 */
const paymentMethodKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${EMOJI.TELEBIRR} Telebirr`, 'deposit_telebirr'),
      Markup.button.callback(`${EMOJI.CBE} CBE`, 'deposit_cbe')
    ],
    [
      Markup.button.callback('❌ Cancel', 'deposit_cancel')
    ]
  ]);
};

/**
 * Deposit amount suggestions
 */
const depositAmountKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('50 ብር', 'deposit_amount_50'),
      Markup.button.callback('100 ብር', 'deposit_amount_100'),
      Markup.button.callback('200 ብር', 'deposit_amount_200')
    ],
    [
      Markup.button.callback('500 ብር', 'deposit_amount_500'),
      Markup.button.callback('1000 ብር', 'deposit_amount_1000')
    ],
    [
      Markup.button.callback('❌ Cancel', 'deposit_cancel')
    ]
  ]);
};

/**
 * Admin deposit notification (no approve/reject buttons — use dashboard)
 */
const depositConfirmKeyboard = (depositId, userId) => {
  const url = `${DASHBOARD_URL}/deposits?depositId=${encodeURIComponent(depositId)}&userId=${encodeURIComponent(userId)}`;
  return Markup.inlineKeyboard([
    [
      Markup.button.url('📊 Open Dashboard', url)
    ]
  ]);
};

module.exports = {
  paymentMethodKeyboard,
  depositAmountKeyboard,
  depositConfirmKeyboard
};
