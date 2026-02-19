const crypto = require('crypto');
const { CURRENCY, BINGO_RANGES, BINGO_LETTERS } = require('./constants');

/**
 * Format number with currency
 */
const formatCurrency = (amount) => {
  return `${amount.toFixed(2)} ${CURRENCY}`;
};

/**
 * Format number with commas
 */
const formatNumber = (num) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

/**
 * Parse amount from text
 */
const parseAmount = (text) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
};

/**
 * Generate referral code from user ID
 */
const generateRefCode = (userId) => {
  return `ref_${userId}`;
};

/**
 * Parse referral code to get user ID
 */
const parseRefCode = (refCode) => {
  if (!refCode || !refCode.startsWith('ref_')) {
    return null;
  }
  const userId = parseInt(refCode.replace('ref_', ''));
  return isNaN(userId) ? null : userId;
};

/**
 * Escape markdown special characters
 */
const escapeMarkdown = (text) => {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
};

/**
 * Get user display name
 */
const getUserDisplayName = (user) => {
  if (user.firstName || user.first_name) {
    return user.firstName || user.first_name;
  }
  if (user.username) {
    return `@${user.username}`;
  }
  return `User ${user.telegramId || user.id}`;
};

/**
 * Generate random bingo numbers (crypto-safe)
 * @param {number} count
 * @param {number} min
 * @param {number} max
 * @returns {number[]}
 */
const generateBingoNumbers = (count = 5, min = 1, max = 90) => {
  const numbers = new Set();
  while (numbers.size < count) {
    const num = crypto.randomInt(min, max + 1);
    numbers.add(num);
  }
  return Array.from(numbers).sort((a, b) => a - b);
};

/**
 * Generate a proper 5x5 Bingo board with correct column ranges
 * B: 1-15, I: 16-30, N: 31-45 (FREE center), G: 46-60, O: 61-75
 * @returns {number[][]} 5x5 grid (rows × columns)
 */
const generateBingoBoard = () => {
  const columns = {};

  // Generate 5 unique numbers per column using crypto
  for (const letter of BINGO_LETTERS) {
    const range = BINGO_RANGES[letter];
    const nums = new Set();
    while (nums.size < 5) {
      nums.add(crypto.randomInt(range.min, range.max + 1));
    }
    columns[letter] = Array.from(nums);
  }

  // Build 5x5 grid (row-major: board[row][col])
  const board = [];
  for (let row = 0; row < 5; row++) {
    const rowData = [];
    for (let col = 0; col < 5; col++) {
      const letter = BINGO_LETTERS[col];
      if (row === 2 && col === 2) {
        rowData.push(0); // FREE space
      } else {
        rowData.push(columns[letter][row]);
      }
    }
    board.push(rowData);
  }

  return board;
};

/**
 * Hash a board for audit trail
 * @param {number[][]} board
 * @returns {string} SHA-256 hex hash
 */
const hashBoard = (board) => {
  const content = JSON.stringify(board);
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Validate a Bingo win — checks horizontal, vertical, diagonal lines
 * @param {number[][]} board - 5x5 grid
 * @param {number[]} calledNumbers - all called numbers
 * @param {string} pattern - 'horizontal', 'vertical', 'diagonal', 'any'
 * @returns {{ isWin: boolean, pattern: string, line: number[] }}
 */
const validateBingoWin = (board, calledNumbers, pattern = 'any') => {
  const calledSet = new Set(calledNumbers);
  
  // Helper: check if all cells in a line are called or FREE (0)
  const isLineComplete = (cells) => {
    return cells.every(num => num === 0 || calledSet.has(num));
  };

  // Check horizontal lines
  if (pattern === 'any' || pattern === 'horizontal') {
    for (let row = 0; row < 5; row++) {
      if (isLineComplete(board[row])) {
        return { isWin: true, pattern: 'horizontal', line: board[row] };
      }
    }
  }

  // Check vertical lines
  if (pattern === 'any' || pattern === 'vertical') {
    for (let col = 0; col < 5; col++) {
      const column = board.map(row => row[col]);
      if (isLineComplete(column)) {
        return { isWin: true, pattern: 'vertical', line: column };
      }
    }
  }

  // Check diagonals
  if (pattern === 'any' || pattern === 'diagonal') {
    const diag1 = [board[0][0], board[1][1], board[2][2], board[3][3], board[4][4]];
    const diag2 = [board[0][4], board[1][3], board[2][2], board[3][1], board[4][0]];
    
    if (isLineComplete(diag1)) {
      return { isWin: true, pattern: 'diagonal', line: diag1 };
    }
    if (isLineComplete(diag2)) {
      return { isWin: true, pattern: 'diagonal', line: diag2 };
    }
  }

  return { isWin: false, pattern: null, line: null };
};

/**
 * Get Bingo column letter for a number
 * @param {number} num - 1-75
 * @returns {string}
 */
const getBingoLetter = (num) => {
  for (const letter of BINGO_LETTERS) {
    const range = BINGO_RANGES[letter];
    if (num >= range.min && num <= range.max) return letter;
  }
  return 'B';
};

/**
 * Check if array contains winning numbers (legacy)
 */
const checkWin = (userNumbers, winningNumbers, requiredMatches = 5) => {
  const matches = userNumbers.filter(n => winningNumbers.includes(n));
  return matches.length >= requiredMatches;
};

/**
 * Sleep for specified milliseconds
 */
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Validate phone number (Ethiopian format)
 */
const isValidPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  return /^(09\d{8}|251\d{9})$/.test(cleaned);
};

/**
 * Format phone number
 */
const formatPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('251')) {
    return `0${cleaned.slice(3)}`;
  }
  return cleaned;
};

module.exports = {
  formatCurrency,
  formatNumber,
  parseAmount,
  generateRefCode,
  parseRefCode,
  escapeMarkdown,
  getUserDisplayName,
  generateBingoNumbers,
  generateBingoBoard,
  hashBoard,
  validateBingoWin,
  getBingoLetter,
  checkWin,
  sleep,
  isValidPhone,
  formatPhone
};
