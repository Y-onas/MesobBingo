const { Markup } = require('telegraf');
const { EMOJI } = require('./constants');
const logger = require('./logger');

/**
 * Build a broadcast keyboard based on button type
 * @param {string} buttonType - Type of button (play, deposit, balance, invite, none)
 * @param {string} botUsername - Bot username for URL construction
 * @returns {object|undefined} Telegraf keyboard markup or undefined if no button
 */
const buildBroadcastKeyboard = (buttonType, botUsername) => {
  if (!buttonType || buttonType === 'none' || !botUsername) {
    return undefined;
  }

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
      logger.warn(`Unknown broadcast buttonType: ${buttonType}`);
      return undefined;
  }

  return Markup.inlineKeyboard([
    [Markup.button.url(buttonText, buttonUrl)]
  ]);
};

module.exports = {
  buildBroadcastKeyboard
};
