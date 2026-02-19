const { Markup } = require('telegraf');
const { EMOJI } = require('../utils/constants');

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
  return Markup.inlineKeyboard([
    [
      Markup.button.url('📊 Open Dashboard', 'http://localhost:5173/deposits')
    ]
  ]);
};

module.exports = {
  paymentMethodKeyboard,
  depositAmountKeyboard,
  depositConfirmKeyboard
};
