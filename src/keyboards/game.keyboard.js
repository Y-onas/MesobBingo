const { Markup } = require('telegraf');
const { GAME_STAKES, EMOJI } = require('../utils/constants');

/**
 * Stake selection keyboard
 */
const stakeKeyboard = () => {
  const buttons = GAME_STAKES.map(stake => 
    Markup.button.callback(`${stake} ብር`, `game_stake_${stake}`)
  );
  
  // Arrange in rows of 3
  const rows = [];
  for (let i = 0; i < buttons.length; i += 3) {
    rows.push(buttons.slice(i, i + 3));
  }
  rows.push([Markup.button.callback('❌ Cancel', 'game_cancel')]);
  
  return Markup.inlineKeyboard(rows);
};

/**
 * Board selection keyboard
 */
const boardKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Board A', 'game_board_A'),
      Markup.button.callback('Board B', 'game_board_B'),
      Markup.button.callback('Board C', 'game_board_C')
    ],
    [
      Markup.button.callback('Board D', 'game_board_D'),
      Markup.button.callback('Board E', 'game_board_E')
    ],
    [
      Markup.button.callback('🔙 Back', 'game_back_stake'),
      Markup.button.callback('❌ Cancel', 'game_cancel')
    ]
  ]);
};

/**
 * Generate number grid keyboard (1-90)
 * @param {number[]} selectedNumbers - Already selected numbers
 */
const numberGridKeyboard = (selectedNumbers = []) => {
  const rows = [];
  
  // Create 9 rows of 10 numbers each
  for (let row = 0; row < 9; row++) {
    const rowButtons = [];
    for (let col = 0; col < 10; col++) {
      const num = row * 10 + col + 1;
      const isSelected = selectedNumbers.includes(num);
      const label = isSelected ? `✅${num}` : `${num}`;
      rowButtons.push(Markup.button.callback(label, `game_num_${num}`));
    }
    rows.push(rowButtons);
  }
  
  // Add control row
  rows.push([
    Markup.button.callback(`Selected: ${selectedNumbers.length}/5`, 'game_info'),
    Markup.button.callback('🎲 Play', 'game_play'),
    Markup.button.callback('🔄 Clear', 'game_clear')
  ]);
  
  rows.push([
    Markup.button.callback('🔙 Back', 'game_back_board'),
    Markup.button.callback('❌ Cancel', 'game_cancel')
  ]);
  
  return Markup.inlineKeyboard(rows);
};

/**
 * Play mode selection inline keyboard
 */
const playModeKeyboard = (webAppUrl) => {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🎮 Play Game', webAppUrl)]
  ]);
};

/**
 * Game result keyboard
 */
const gameResultKeyboard = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎰 Play Again', 'play_start'),
      Markup.button.callback('🔙 Menu', 'game_cancel')
    ]
  ]);
};

module.exports = {
  stakeKeyboard,
  boardKeyboard,
  numberGridKeyboard,
  playModeKeyboard,
  gameResultKeyboard
};
