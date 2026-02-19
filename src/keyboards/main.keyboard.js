const { Markup } = require('telegraf');
const { EMOJI } = require('../utils/constants');

/**
 * Main menu keyboard
 */
const mainKeyboard = () => {
  return Markup.keyboard([
    [`${EMOJI.PLAY} Play`],
    [`${EMOJI.DEPOSIT} Deposit`, `${EMOJI.WITHDRAW} Withdraw`],
    [`${EMOJI.BALANCE} Check Balance`],
    [`${EMOJI.INVITE} Invite`, `${EMOJI.HELP} How To Play`],
    [`${EMOJI.CONTACT} Contact Us`, `${EMOJI.JOIN} Join Us`],
    [`${EMOJI.TRANSFER} Transfer`]
  ]).resize();
};

/**
 * Admin main keyboard
 */
const adminKeyboard = () => {
  return Markup.keyboard([
    [`${EMOJI.PLAY} Play`],
    [`${EMOJI.DEPOSIT} Deposit`, `${EMOJI.WITHDRAW} Withdraw`],
    [`${EMOJI.BALANCE} Check Balance`],
    [`${EMOJI.INVITE} Invite`, `${EMOJI.HELP} How To Play`],
    [`${EMOJI.CONTACT} Contact Us`, `${EMOJI.JOIN} Join Us`],
    [`${EMOJI.TRANSFER} Transfer`],
    [`${EMOJI.ADMIN} Admin Panel`]
  ]).resize();
};

/**
 * Cancel keyboard
 */
const cancelKeyboard = () => {
  return Markup.keyboard([
    ['❌ Cancel']
  ]).resize();
};

/**
 * Back to menu keyboard
 */
const backToMenuKeyboard = () => {
  return Markup.keyboard([
    ['🔙 Back to Menu']
  ]).resize();
};

module.exports = {
  mainKeyboard,
  adminKeyboard,
  cancelKeyboard,
  backToMenuKeyboard
};
