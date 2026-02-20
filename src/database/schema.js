const { pgTable, bigint, text, numeric, boolean, timestamp, serial, varchar, integer } = require('drizzle-orm/pg-core');

// ─────────────────────────────────────────────────────────────────────
// DATABASE SCHEMA DEFINITIONS
// All tables have corresponding migration files in drizzle/ directory
// ─────────────────────────────────────────────────────────────────────

// ─── Users Table ───────────────────────────────────────────────────── 
// Migration: drizzle/0000_init_schema.sql
const users = pgTable('users', {
  telegramId: bigint('telegram_id', { mode: 'number' }).primaryKey(),
  username: text('username'),
  firstName: text('first_name').default(''),
  lastName: text('last_name').default(''),
  phone: text('phone'),
  mainWallet: numeric('main_wallet', { precision: 12, scale: 2 }).default('0').notNull(),
  playWallet: numeric('play_wallet', { precision: 12, scale: 2 }).default('0').notNull(),
  referredBy: bigint('referred_by', { mode: 'number' }),
  referralCount: bigint('referral_count', { mode: 'number' }).default(0).notNull(),
  referralEarnings: numeric('referral_earnings', { precision: 12, scale: 2 }).default('0').notNull(),
  depositCount: bigint('deposit_count', { mode: 'number' }).default(0).notNull(),
  totalDeposited: numeric('total_deposited', { precision: 12, scale: 2 }).default('0').notNull(),
  totalWithdrawn: numeric('total_withdrawn', { precision: 12, scale: 2 }).default('0').notNull(),
  gamesPlayed: bigint('games_played', { mode: 'number' }).default(0).notNull(),
  gamesWon: bigint('games_won', { mode: 'number' }).default(0).notNull(),
  isBanned: boolean('is_banned').default(false).notNull(),
  bonusClaimed: boolean('bonus_claimed').default(false).notNull(),
  phoneVerified: boolean('phone_verified').default(false).notNull(),
  lastActive: timestamp('last_active').defaultNow(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Deposits Table ──────────────────────────────────────────────────
// Migration: drizzle/0000_init_schema.sql, drizzle/0002_add_sms_text_field.sql
const deposits = pgTable('deposits', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  method: varchar('method', { length: 20 }).notNull(), // 'telebirr' or 'cbe'
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, under_review, approved, rejected
  screenshotFileId: text('screenshot_file_id'),
  smsText: text('sms_text'), // SMS message text from payment provider
  transactionRef: text('transaction_ref'),
  assignedAdmin: text('assigned_admin'), // admin who locked this for review
  processedBy: bigint('processed_by', { mode: 'number' }),
  processedAt: timestamp('processed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Withdrawals Table ───────────────────────────────────────────────
// Migration: drizzle/0000_init_schema.sql
const withdrawals = pgTable('withdrawals', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  method: varchar('method', { length: 20 }).notNull(),
  accountNumber: text('account_number').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, under_review, approved, rejected
  assignedAdmin: text('assigned_admin'), // admin who locked this for review
  processedBy: bigint('processed_by', { mode: 'number' }),
  processedAt: timestamp('processed_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Admins Table ────────────────────────────────────────────────────
// Migration: drizzle/0000_init_schema.sql
const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  telegramId: bigint('telegram_id', { mode: 'number' }).unique(),
  name: text('name').notNull(),
  email: text('email'),
  role: varchar('role', { length: 20 }).default('support_admin').notNull(), // super_admin, finance_admin, support_admin
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Audit Logs Table ────────────────────────────────────────────────
// Migration: drizzle/0000_init_schema.sql
const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  adminId: text('admin_id').notNull(),
  adminName: text('admin_name').notNull(),
  actionType: varchar('action_type', { length: 50 }).notNull(),
  targetUser: text('target_user'),
  amount: numeric('amount', { precision: 12, scale: 2 }),
  details: text('details'),
  ipAddress: text('ip_address'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// ─── Fraud Alerts Table ──────────────────────────────────────────────
// Migration: drizzle/0000_init_schema.sql
const fraudAlerts = pgTable('fraud_alerts', {
  id: serial('id').primaryKey(),
  alertType: varchar('alert_type', { length: 50 }).notNull(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  username: text('username'),
  riskScore: integer('risk_score').default(0).notNull(),
  description: text('description'),
  resolved: boolean('resolved').default(false).notNull(),
  resolvedBy: text('resolved_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Game Rooms Table ────────────────────────────────────────────────
// Migration: drizzle/0003_add_game_tables.sql, drizzle/0005_add_dynamic_win_percentage.sql
const gameRooms = pgTable('game_rooms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  entryFee: numeric('entry_fee', { precision: 12, scale: 2 }).notNull(),
  minPlayers: integer('min_players').default(5).notNull(),
  maxPlayers: integer('max_players').default(20).notNull(),
  currentPlayers: integer('current_players').default(0).notNull(),
  countdownTime: integer('countdown_time').default(120).notNull(),
  winningPercentage: integer('winning_percentage').default(75).notNull(),
  useDynamicPercentage: boolean('use_dynamic_percentage').default(false).notNull(),
  totalPot: numeric('total_pot', { precision: 12, scale: 2 }).default('0').notNull(),
  expectedPayout: numeric('expected_payout', { precision: 12, scale: 2 }).default('0').notNull(),
  commission: numeric('commission', { precision: 12, scale: 2 }).default('0').notNull(),
  status: varchar('status', { length: 20 }).default('waiting').notNull(), // waiting, active, completed
  winnerTimeWindowMs: integer('winner_time_window_ms').default(100).notNull(), // Time window for multiple winners (100ms = imperceptible to humans)
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Games Table (Individual Game Sessions) ─────────────────────────
// Migration: drizzle/0003_add_game_tables.sql, drizzle/0004_add_multi_winner_support.sql
const games = pgTable('games', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').notNull(),
  status: varchar('status', { length: 20 }).default('waiting').notNull(), // waiting, lobby, countdown, playing, completed, cancelled
  winPattern: varchar('win_pattern', { length: 20 }).default('any').notNull(), // horizontal, vertical, diagonal, any
  winnerId: bigint('winner_id', { mode: 'number' }), // First winner (for backward compatibility)
  winnerBoardNumber: integer('winner_board_number'),
  winners: text('winners').default('[]').notNull(), // NEW: JSONB array of all winners
  winnerCount: integer('winner_count').default(0).notNull(), // NEW: Number of winners
  prizePerWinner: numeric('prize_per_winner', { precision: 10, scale: 2 }).default('0').notNull(), // NEW: Prize split amount
  prizePool: numeric('prize_pool', { precision: 12, scale: 2 }).default('0').notNull(),
  commission: numeric('commission', { precision: 12, scale: 2 }).default('0').notNull(),
  playerCount: integer('player_count').default(0).notNull(),
  totalCalls: integer('total_calls').default(0).notNull(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Boards Table (Pre-generated 5x5 Bingo boards per game) ────────
// Migration: drizzle/0003_add_game_tables.sql
const boards = pgTable('boards', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull(),
  boardNumber: integer('board_number').notNull(), // 1-200
  content: text('content').notNull(), // JSON string of 5x5 grid
  boardHash: text('board_hash').notNull(), // SHA-256 hash for audit
  assignedTo: bigint('assigned_to', { mode: 'number' }), // telegram_id
  assignedAt: timestamp('assigned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Game Players Table ─────────────────────────────────────────────
// Migration: drizzle/0003_add_game_tables.sql, drizzle/0004_add_multi_winner_support.sql
const gamePlayers = pgTable('game_players', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull(),
  telegramId: bigint('telegram_id', { mode: 'number' }).notNull(),
  boardNumber: integer('board_number').notNull(),
  betAmount: numeric('bet_amount', { precision: 12, scale: 2 }).notNull(),
  falseClaimCount: integer('false_claim_count').default(0).notNull(), // NEW: Track false claims
  removedForFalseClaims: boolean('removed_for_false_claims').default(false).notNull(), // NEW: Removal flag
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// ─── Called Numbers Table ───────────────────────────────────────────
// Migration: drizzle/0003_add_game_tables.sql
const calledNumbers = pgTable('called_numbers', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull(),
  number: integer('number').notNull(), // 1-75
  callOrder: integer('call_order').notNull(),
  calledAt: timestamp('called_at').defaultNow().notNull(),
});

// ─── Win Percentage Rules Table ─────────────────────────────────────
// Migration: drizzle/0005_add_dynamic_win_percentage.sql
// Includes: Foreign key to game_rooms, indexes on room_id and range queries
const winPercentageRules = pgTable('win_percentage_rules', {
  id: serial('id').primaryKey(),
  roomId: integer('room_id').notNull(),
  minPlayers: integer('min_players').notNull(),
  maxPlayers: integer('max_players').notNull(),
  winPercentage: integer('win_percentage').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

module.exports = { users, deposits, withdrawals, admins, auditLogs, fraudAlerts, gameRooms, games, boards, gamePlayers, calledNumbers, winPercentageRules };
