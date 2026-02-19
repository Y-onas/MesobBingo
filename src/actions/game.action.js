const { CURRENCY } = require('../utils/constants');
const { stakeKeyboard, boardKeyboard, numberGridKeyboard, gameResultKeyboard } = require('../keyboards/game.keyboard');
const { mainKeyboard } = require('../keyboards/main.keyboard');
const gameService = require('../services/game.service');
const userService = require('../services/user.service');

/**
 * Handle play start
 */
const handlePlayStart = async (ctx) => {
  try {
    const user = await userService.getUser(ctx.from.id);
    if (!user) {
      return ctx.answerCbQuery('Please use /start first.');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🎰 *Select Your Stake*

💰 Your Balance:
• Main Wallet: ${Number(user.mainWallet).toFixed(2)} ${CURRENCY}
• Play Wallet: ${Number(user.playWallet).toFixed(2)} ${CURRENCY}

Choose how much you want to bet:`, {
      parse_mode: 'Markdown',
      ...stakeKeyboard()
    });
  } catch (error) {
    console.error('Error in play start:', error);
  }
};

/**
 * Handle stake selection
 */
const handleStakeSelect = async (ctx) => {
  try {
    const stake = parseInt(ctx.callbackQuery.data.split('_')[2]);
    
    if (!gameService.isValidStake(stake)) {
      return ctx.answerCbQuery('Invalid stake');
    }
    
    const user = await userService.getUser(ctx.from.id);
    const totalBalance = Number(user.mainWallet) + Number(user.playWallet);
    
    if (totalBalance < stake) {
      return ctx.answerCbQuery('Insufficient balance!');
    }
    
    // Start game with stake
    gameService.startGame(ctx.from.id, stake, null);
    
    await ctx.answerCbQuery(`Stake: ${stake} ${CURRENCY}`);
    await ctx.editMessageText(`🎯 *Select Your Board*

💰 Stake: ${stake} ${CURRENCY}

Choose a board:`, {
      parse_mode: 'Markdown',
      ...boardKeyboard()
    });
  } catch (error) {
    console.error('Error in stake select:', error);
  }
};

/**
 * Handle board selection
 */
const handleBoardSelect = async (ctx) => {
  try {
    const board = ctx.callbackQuery.data.split('_')[2];
    const game = gameService.getActiveGame(ctx.from.id);
    
    if (!game) {
      return ctx.answerCbQuery('No active game. Start over.');
    }
    
    game.board = board;
    
    await ctx.answerCbQuery(`Board ${board} selected`);
    await ctx.editMessageText(`🔢 *Select 5 Numbers*

💰 Stake: ${game.stake} ${CURRENCY}
🎯 Board: ${board}

Select exactly 5 numbers from 1-90:`, {
      parse_mode: 'Markdown',
      ...numberGridKeyboard(game.selectedNumbers)
    });
  } catch (error) {
    console.error('Error in board select:', error);
  }
};

/**
 * Handle number selection
 */
const handleNumberSelect = async (ctx) => {
  try {
    const num = parseInt(ctx.callbackQuery.data.split('_')[2]);
    const game = gameService.selectNumber(ctx.from.id, num);
    
    if (!game) {
      return ctx.answerCbQuery('No active game.');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🔢 *Select 5 Numbers*

💰 Stake: ${game.stake} ${CURRENCY}
🎯 Board: ${game.board}
✅ Selected: ${game.selectedNumbers.join(', ') || 'None'}

Select exactly 5 numbers from 1-90:`, {
      parse_mode: 'Markdown',
      ...numberGridKeyboard(game.selectedNumbers)
    });
  } catch (error) {
    console.error('Error in number select:', error);
  }
};

/**
 * Handle clear numbers
 */
const handleClearNumbers = async (ctx) => {
  try {
    const game = gameService.clearNumbers(ctx.from.id);
    
    if (!game) {
      return ctx.answerCbQuery('No active game.');
    }
    
    await ctx.answerCbQuery('Cleared!');
    await ctx.editMessageText(`🔢 *Select 5 Numbers*

💰 Stake: ${game.stake} ${CURRENCY}
🎯 Board: ${game.board}
✅ Selected: None

Select exactly 5 numbers from 1-90:`, {
      parse_mode: 'Markdown',
      ...numberGridKeyboard([])
    });
  } catch (error) {
    console.error('Error in clear numbers:', error);
  }
};

/**
 * Handle play game
 */
const handlePlayGame = async (ctx) => {
  try {
    const game = gameService.getActiveGame(ctx.from.id);
    
    if (!game) {
      return ctx.answerCbQuery('No active game.');
    }
    
    if (game.selectedNumbers.length !== 5) {
      return ctx.answerCbQuery('Please select exactly 5 numbers!');
    }
    
    await ctx.answerCbQuery('Playing...');
    
    // Play the game
    const result = await gameService.playGame(ctx.from.id);
    
    // Build result message
    let resultMessage;
    if (result.isWin) {
      resultMessage = `🎉 *CONGRATULATIONS!* 🎉

You matched *${result.matchCount}* numbers!

💰 *You Won: ${result.winAmount.toFixed(2)} ${CURRENCY}!*

━━━━━━━━━━━━━━━━
🎯 Your Numbers: ${result.selectedNumbers.join(', ')}
🔮 Winning Numbers: ${result.winningNumbers.join(', ')}`;
    } else {
      resultMessage = `😔 *Better Luck Next Time!*

You matched *${result.matchCount}* numbers.

━━━━━━━━━━━━━━━━
🎯 Your Numbers: ${result.selectedNumbers.join(', ')}
🔮 Winning Numbers: ${result.winningNumbers.join(', ')}

Try again! 🎰`;
    }
    
    await ctx.editMessageText(resultMessage, {
      parse_mode: 'Markdown',
      ...gameResultKeyboard()
    });
  } catch (error) {
    console.error('Error playing game:', error);
    await ctx.answerCbQuery('Error: ' + error.message);
  }
};

/**
 * Handle game cancel
 */
const handleGameCancel = async (ctx) => {
  try {
    gameService.cancelGame(ctx.from.id);
    
    await ctx.answerCbQuery('Game cancelled');
    await ctx.editMessageText('❌ Game cancelled. Use /play to start a new game.');
  } catch (error) {
    console.error('Error in game cancel:', error);
  }
};

/**
 * Handle back to stake
 */
const handleBackToStake = async (ctx) => {
  try {
    const user = await userService.getUser(ctx.from.id);
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🎰 *Select Your Stake*

💰 Your Balance:
• Main Wallet: ${Number(user.mainWallet).toFixed(2)} ${CURRENCY}
• Play Wallet: ${Number(user.playWallet).toFixed(2)} ${CURRENCY}

Choose how much you want to bet:`, {
      parse_mode: 'Markdown',
      ...stakeKeyboard()
    });
  } catch (error) {
    console.error('Error in back to stake:', error);
  }
};

/**
 * Handle back to board
 */
const handleBackToBoard = async (ctx) => {
  try {
    const game = gameService.getActiveGame(ctx.from.id);
    
    if (!game) {
      return ctx.answerCbQuery('No active game.');
    }
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(`🎯 *Select Your Board*

💰 Stake: ${game.stake} ${CURRENCY}

Choose a board:`, {
      parse_mode: 'Markdown',
      ...boardKeyboard()
    });
  } catch (error) {
    console.error('Error in back to board:', error);
  }
};

/**
 * Register game actions
 */
const register = (bot) => {
  bot.action('play_start', handlePlayStart);
  bot.action(/^game_stake_\d+$/, handleStakeSelect);
  bot.action(/^game_board_[A-E]$/, handleBoardSelect);
  bot.action(/^game_num_\d+$/, handleNumberSelect);
  bot.action('game_clear', handleClearNumbers);
  bot.action('game_play', handlePlayGame);
  bot.action('game_cancel', handleGameCancel);
  bot.action('game_back_stake', handleBackToStake);
  bot.action('game_back_board', handleBackToBoard);
  bot.action('game_info', (ctx) => ctx.answerCbQuery('Select exactly 5 numbers'));
};

module.exports = { register };
