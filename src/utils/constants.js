// Bot Information
const BOT_NAME = 'Mesob Bingo';
// BOT_USERNAME is now dynamic - get from configService.get('bot_username')
const CURRENCY = 'ብር'; // Ethiopian Birr

// Emojis
const EMOJI = {
  PLAY: '🎰',
  DEPOSIT: '💰',
  WITHDRAW: '🏧',
  BALANCE: '💳',
  INVITE: '🤝',
  HELP: '📖',
  CONTACT: '🏪',
  JOIN: '👥',
  TRANSFER: '🎁',
  MONEY: '💵',
  WIN: '🎉',
  LOSE: '😔',
  STAR: '⭐',
  CHECK: '✅',
  CROSS: '❌',
  LINK: '🔗',
  SHARE: '📤',
  WALLET: '👛',
  MAIN_WALLET: '🏦',
  PLAY_WALLET: '🎁',
  TOTAL: '💰',
  ROCKET: '🚀',
  RECYCLE: '🔄',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  ADMIN: '👨‍💼',
  USER: '👤',
  USERS: '👥',
  BROADCAST: '📢',
  BONUS: '🎁',
  GAME: '🎲',
  BINGO: '🎯',
  TELEBIRR: '📱',
  CBE: '🏦'
};

// Messages
const MESSAGES = {
  WELCOME: `🎰 *እንኳን ወደ ${BOT_NAME} በደህና መጡ!* 🎰

ለመጫወት ከታች ያለውን ምናሌ ይጠቀሙ:`,

  BALANCE_SUMMARY: `💰 *BALANCE SUMMARY* 💰

🏦 Main Wallet: {mainWallet} ${CURRENCY}
🎁 Play Wallet: {playWallet} ${CURRENCY}
━━━━━━━━━━━━━━━━
💵 Total Balance: {total} ${CURRENCY}`,

  INVITE_MESSAGE: `🤝 *Invite Friends & Earn Bonus!*
🚀

Share your personal link to earn bonuses!

*How it works:*
💰 Earn bonus on your referral's FIRST deposit:

📊 *Bonus Tiers:*
• 50-99 ${CURRENCY} → Get 5 ${CURRENCY}
• 100-199 ${CURRENCY} → Get 10 ${CURRENCY}  
• 200-499 ${CURRENCY} → Get 20 ${CURRENCY}
• 500+ ${CURRENCY} → Get 30 ${CURRENCY}

⚠️ Minimum: 50 ${CURRENCY} deposit to qualify`,

  HOW_TO_PLAY: `📖 *How To Play*

Pick a stake → choose a board → select numbers.

1. ገንዘብ ያስቀምጡ (Deposit)
2. Play ይንኩ
3. ቁጥሮችዎን ይምረጡ
4. ካሸነፉ ወዲያውኑ ገንዘቡ ወደ ዋሌትዎ ይገባል!`,

  CONTACT_US: `🏪 *Contact Us*

Support: {supportUsername}`,

  JOIN_CHANNEL: `👥 *Join Us*

Join our channel: {channelUrl}`,

  DEPOSIT_INSTRUCTIONS: `💰 *Deposit Instructions*

ገንዘብ ለማስገባት ከታች አንዱን የክፍያ ዘዴ ይምረጡ:`,

  DEPOSIT_TELEBIRR: `📱 *Telebirr Deposit*

1. ወደ {telebirrNumber} ገንዘብ ያስተላልፉ
2. ካስተላለፉ በኋላ screenshot ያድርጉ
3. Screenshot ን እዚህ ይላኩ

⚠️ ዝቅተኛ ገንዘብ: {minDeposit} ${CURRENCY}`,

  DEPOSIT_CBE: `🏦 *CBE Deposit*

1. ወደ ሂሳብ ቁጥር {cbeAccount} ገንዘብ ያስገቡ
2. ብሩን ከልኩ በኋላ ክፍያው የጸደቀ የ sms መልክት ይደርሰዎታል
3. የደረሰዎትን አጭር የጽሁፍ መልክት(sms) ሙሉዉን ኮፒ(copy) በማረግ ከታች ባለው የቴሌግራም የጽሁፍ ማስገቢያ ላይ ፔስት(paste) በማረግ ይላኩት

⚠️ ዝቅተኛ ገንዘብ: {minDeposit} ${CURRENCY}`,

  WITHDRAW_PROMPT: `🏧 *Withdraw*

Enter the amount to withdraw (e.g. 150 or 150.00). Type 'cancel' to stop.

⚠️ ዝቅተኛ መውጫ: {minWithdraw} ${CURRENCY}`,

  INSUFFICIENT_BALANCE: `❌ *Insufficient Balance*

You don't have enough balance to withdraw this amount.`,

  WITHDRAW_SUCCESS: `✅ *Withdrawal Request Submitted*

Amount: {amount} ${CURRENCY}
Status: Pending

Your withdrawal will be processed soon.`,

  ADMIN_ONLY: `⚠️ This command is for admins only.`,

  TRANSFER_PROMPT: `🎁 *Transfer Funds*

Usage: /transfer [userId] [amount]
Example: /transfer 123456789 100`,

  BONUS_PROMPT: `🎁 *Bonus Management*

Usage: /bonus [userId] [amount]
Example: /bonus 123456789 50`,

  BROADCAST_PROMPT: `📢 *Broadcast Message*

Reply to this message with the content you want to broadcast to all depositors.`
};

// Session States
const SESSION_STATES = {
  NONE: 'none',
  AWAITING_DEPOSIT_METHOD: 'awaiting_deposit_method',
  AWAITING_DEPOSIT_SCREENSHOT: 'awaiting_deposit_screenshot',
  AWAITING_DEPOSIT_SMS: 'awaiting_deposit_sms',
  AWAITING_WITHDRAW_AMOUNT: 'awaiting_withdraw_amount',
  AWAITING_WITHDRAW_PHONE: 'awaiting_withdraw_phone',
  AWAITING_WITHDRAW_ACCOUNT_NAME: 'awaiting_withdraw_account_name',
  AWAITING_GAME_STAKE: 'awaiting_game_stake',
  AWAITING_GAME_BOARD: 'awaiting_game_board',
  AWAITING_GAME_NUMBERS: 'awaiting_game_numbers',
  AWAITING_BROADCAST_MESSAGE: 'awaiting_broadcast_message',
  AWAITING_TRANSFER_DETAILS: 'awaiting_transfer_details',
  AWAITING_BONUS_DETAILS: 'awaiting_bonus_details'
};

// Game Stakes - now dynamic, use configService.get('game_stakes', [10, 20, 50, 100])

// Board Types
const BOARD_TYPES = ['A', 'B', 'C', 'D', 'E'];

// ─── Bingo Column Ranges ────────────────────────────────────────────
const BINGO_RANGES = {
  B: { min: 1, max: 15 },
  I: { min: 16, max: 30 },
  N: { min: 31, max: 45 },
  G: { min: 46, max: 60 },
  O: { min: 61, max: 75 },
};

const BINGO_LETTERS = ['B', 'I', 'N', 'G', 'O'];

// ─── Game States ────────────────────────────────────────────────────
const GAME_STATES = {
  WAITING: 'waiting',
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

// ─── Win Patterns ───────────────────────────────────────────────────
const WIN_PATTERNS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  DIAGONAL: 'diagonal',
  ANY: 'any', // any line wins
};

// ─── Socket.IO Events ──────────────────────────────────────────────
const SOCKET_EVENTS = {
  // Client → Server
  JOIN_GAME: 'join_game',
  SELECT_BOARD: 'select_board',
  CLAIM_BINGO: 'claim_bingo',
  LEAVE_GAME: 'leave_game',
  GET_ROOMS: 'get_rooms',
  GET_BALANCE: 'get_balance',
  CHECK_ACTIVE_GAME: 'check_active_game',

  // Server → Client
  ROOMS_LIST: 'rooms_list',
  ROOM_UPDATE: 'room_update',
  GAME_JOINED: 'game_joined',
  BOARD_ASSIGNED: 'board_assigned',
  BOARD_UNAVAILABLE: 'board_unavailable',
  AVAILABLE_BOARDS: 'available_boards',
  COUNTDOWN_START: 'countdown_start',
  COUNTDOWN_TICK: 'countdown_tick',
  GAME_STARTED: 'game_started',
  NUMBER_CALLED: 'number_called',
  BINGO_RESULT: 'bingo_result',
  GAME_WON: 'game_won',
  GAME_ENDED: 'game_ended',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
  BALANCE_UPDATE: 'balance_update',
  FALSE_CLAIM_WARNING: 'false_claim_warning',
  PLAYER_REMOVED: 'player_removed',
  MULTIPLE_WINNERS: 'multiple_winners',
  FORCE_LEAVE_GAME: 'force_leave_game',
  ERROR: 'error_msg',
};

// ─── Connection Limits ──────────────────────────────────────────────
const { MAX_CONNECTIONS_PER_USER, MAX_CONNECTIONS_PER_IP, MAX_TOTAL_CONNECTIONS } = require('../config/env');

const CONNECTION_LIMITS = {
  MAX_PER_USER: MAX_CONNECTIONS_PER_USER,
  MAX_PER_IP: MAX_CONNECTIONS_PER_IP,
  MAX_TOTAL: MAX_TOTAL_CONNECTIONS,
  HANDSHAKE_TIMEOUT_MS: 30000,
  HEARTBEAT_INTERVAL_MS: 30000,
  IDLE_TIMEOUT_MS: 120000, // 2 minutes
  MAX_SESSION_MS: 7200000, // 2 hours
  MAX_PAYLOAD_BYTES: 16 * 1024, // 16KB
};

// ─── Disconnect Grace Periods ───────────────────────────────────────
const DISCONNECT_GRACE_PERIODS = {
  GAME_PAUSE_TIMEOUT_MS: 40000,  // 40 seconds - pause game, then house wins if no reconnection
};

// ─── Rate Limits ────────────────────────────────────────────────────
const RATE_LIMITS = {
  GLOBAL: { windowMs: 1000, max: 10 },
  BINGO_CLAIM: { windowMs: 5000, max: 3 },
  JOIN_GAME: { windowMs: 10000, max: 5 },
};

module.exports = {
  BOT_NAME,
  // BOT_USERNAME removed - use configService.get('bot_username') instead
  // GAME_STAKES removed - use configService.get('game_stakes', [10, 20, 50, 100]) instead
  CURRENCY,
  EMOJI,
  MESSAGES,
  SESSION_STATES,
  BOARD_TYPES,
  BINGO_RANGES,
  BINGO_LETTERS,
  GAME_STATES,
  WIN_PATTERNS,
  SOCKET_EVENTS,
  CONNECTION_LIMITS,
  DISCONNECT_GRACE_PERIODS,
  RATE_LIMITS,
};
