// ─── Dynamic Configuration Service ──────────────────────────────────
// Production-grade config service with:
//  • In-memory caching with fail-safe defaults
//  • Validation guards to prevent breaking production
//  • Hot reload via EventEmitter
//  • Config versioning + rollback
//  • Category-based role permissions
//  • Referral tier lookups from DB
// ────────────────────────────────────────────────────────────────────

const { db } = require('../database');
const { systemConfig, systemConfigHistory, referralTiers, paymentAccounts } = require('../database/schema');
const { eq, desc, and, asc } = require('drizzle-orm');
const logger = require('../utils/logger');
const EventEmitter = require('events');

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',           // NEW: Can do finance + support (but not manage admins or settings)
  FINANCE_ADMIN: 'finance_admin',
  SUPPORT_ADMIN: 'support_admin',
};

class ConfigService extends EventEmitter {
  constructor() {
    super();
    this.cache = new Map();
    this.lastKnownGood = new Map(); // Fail-safe if DB down
    this.lastRefresh = null;
    this.CACHE_TTL_MS = 60000; // 1 minute (backup to hot reload)
  }

  // ─── Validation Rules ─────────────────────────────────────────────
  // Prevent invalid configs from breaking production
  VALIDATION_RULES = {
    min_deposit: { type: 'number', min: 10, max: 1000 },
    min_withdraw: { type: 'number', min: 50, max: 10000 },
    countdown_seconds: { type: 'number', min: 10, max: 300 },
    number_call_interval_ms: { type: 'number', min: 1000, max: 10000 },
    max_connections_per_user: { type: 'number', min: 1, max: 10 },
    max_connections_per_ip: { type: 'number', min: 1, max: 50 },
    max_total_connections: { type: 'number', min: 10, max: 10000 },
    welcome_bonus: { type: 'number', min: 0, max: 100 },
    boards_per_game: { type: 'number', min: 10, max: 1000 },
    game_stakes: {
      type: 'json',
      validate: (arr) => Array.isArray(arr) && arr.length > 0 && arr.every(n => typeof n === 'number' && n > 0 && n <= 1000),
    },
    deposits_enabled: { type: 'boolean' },
    withdrawals_enabled: { type: 'boolean' },
    games_enabled: { type: 'boolean' },
  };

  // ─── Required Placeholders for Messages ────────────────────────────
  // If an admin edits a message and forgets a required placeholder, the save is blocked.
  REQUIRED_PLACEHOLDERS = {
    msg_balance: ['{mainWallet}', '{playWallet}', '{total}'],
    msg_deposit_telebirr: ['{telebirrNumber}', '{telebirrName}', '{minDeposit}'],
    msg_deposit_cbe: ['{cbeAccount}', '{cbeAccountName}', '{minDeposit}'],
    msg_withdraw_prompt: ['{minWithdraw}'],
    msg_withdraw_success: ['{amount}'],
    msg_deposit_submitted: ['{amount}', '{method}'],
    msg_contact_us: ['{supportUsername}'],
    msg_join_channel: ['{channelUrl}'],
  };

  // ─── Category Permissions ─────────────────────────────────────────
  // super_admin bypasses all restrictions
  CATEGORY_PERMISSIONS = {
    payment: ROLES.FINANCE_ADMIN,
    game: ROLES.SUPER_ADMIN,
    limits: ROLES.SUPER_ADMIN,
    bonuses: ROLES.FINANCE_ADMIN,
    features: ROLES.SUPER_ADMIN, // Kill switches
  };

  ROLE_HIERARCHY = {
    [ROLES.SUPER_ADMIN]: 4,
    [ROLES.ADMIN]: 3,
    [ROLES.FINANCE_ADMIN]: 2,
    [ROLES.SUPPORT_ADMIN]: 1,
  };

  /**
   * Get configuration value with fail-safe
   */
  async get(key, defaultValue = null) {
    try {
      // Check cache first
      if (this.isCacheValid()) {
        const cached = this.cache.get(key);
        if (cached !== undefined) return cached;
      }

      // Refresh cache if stale
      await this.refreshCache();

      return this.cache.get(key) ?? defaultValue;
    } catch (error) {
      // DB down - use last known good (fail-safe)
      logger.warn(`Config DB error for key ${key}, using last known good`, error);
      return this.lastKnownGood.get(key) ?? defaultValue;
    }
  }

  /**
   * Get request-level config snapshot (consistent reads)
   */
  async getSnapshot(keys) {
    const snapshot = {};
    for (const key of keys) {
      snapshot[key] = await this.get(key);
    }
    return snapshot;
  }

  /**
   * Set configuration value with validation, versioning, and hot reload
   */
  async set(key, value, adminId, adminRole) {
    // 1. Validate value
    this.validate(key, value);

    // 2. Get config metadata
    const configMeta = await this.getConfigMeta(key);

    // 3. Check permissions
    if (!this.hasPermission(adminRole, configMeta.category)) {
      throw new Error(`Insufficient permissions to modify ${configMeta.category} configs`);
    }

    // 4-5. Save history and update config atomically in transaction
    await db.transaction(async (tx) => {
      // Save to history (versioning) — save the OLD value
      await tx.insert(systemConfigHistory).values({
        configKey: key,
        configValue: String(configMeta.configValue),
        valueType: configMeta.valueType,
        category: configMeta.category,
        changedBy: adminId,
      });

      // Update config
      await tx.update(systemConfig)
        .set({
          configValue: String(value),
          updatedBy: adminId,
          updatedAt: new Date(),
        })
        .where(eq(systemConfig.configKey, key));
    });

    // 6. Hot reload - emit event for instant propagation
    this.emit('config:changed', { key, value, adminId });

    // 7. Force cache refresh
    await this.forceRefresh();

    logger.info(`Config updated: ${key} = ${value} by admin ${adminId}`);
  }

  /**
   * Validate config value against rules
   */
  validate(key, value) {
    const rule = this.VALIDATION_RULES[key];
    if (!rule) return; // No validation rule defined

    if (rule.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`${key} must be a number`);
      }
      if (rule.min !== undefined && num < rule.min) {
        throw new Error(`${key} must be >= ${rule.min}`);
      }
      if (rule.max !== undefined && num > rule.max) {
        throw new Error(`${key} must be <= ${rule.max}`);
      }
    }

    if (rule.type === 'json' && rule.validate) {
      let parsed;
      try {
        parsed = typeof value === 'string' ? JSON.parse(value) : value;
      } catch {
        throw new Error(`${key} must be valid JSON`);
      }
      if (!rule.validate(parsed)) {
        throw new Error(`${key} validation failed`);
      }
    }

    if (rule.type === 'boolean') {
      if (value !== 'true' && value !== 'false' && value !== true && value !== false) {
        throw new Error(`${key} must be true or false`);
      }
    }

    // Validate required placeholders for messages
    const requiredPlaceholders = this.REQUIRED_PLACEHOLDERS[key];
    if (requiredPlaceholders) {
      if (typeof value !== 'string') {
        throw new Error(`${key} must be a string text`);
      }
      for (const token of requiredPlaceholders) {
        if (!value.includes(token)) {
          throw new Error(`Message must include the required placeholder: ${token}`);
        }
      }
    }
  }

  /**
   * Check if admin has permission for category
   * Super admins bypass all restrictions
   */
  hasPermission(adminRole, category) {
    if (adminRole === ROLES.SUPER_ADMIN) return true;

    const requiredRole = this.CATEGORY_PERMISSIONS[category];
    if (!requiredRole) return true; // No restriction

    return (this.ROLE_HIERARCHY[adminRole] || 0) >= (this.ROLE_HIERARCHY[requiredRole] || 0);
  }

  /**
   * Get config metadata
   */
  async getConfigMeta(key) {
    const config = await db.select()
      .from(systemConfig)
      .where(eq(systemConfig.configKey, key))
      .limit(1);

    if (config.length === 0) {
      throw new Error(`Config key not found: ${key}`);
    }

    return config[0];
  }

  /**
   * Save config change to history (versioning)
   */
  async saveToHistory(key, value, adminId, configMeta) {
    await db.insert(systemConfigHistory).values({
      configKey: key,
      configValue: String(value),
      valueType: configMeta.valueType,
      category: configMeta.category,
      changedBy: adminId,
    });
  }

  /**
   * Rollback to previous version
   */
  async rollback(key, adminId, adminRole) {
    const history = await db.select()
      .from(systemConfigHistory)
      .where(eq(systemConfigHistory.configKey, key))
      .orderBy(desc(systemConfigHistory.changedAt))
      .limit(2); // Get current and previous

    if (history.length < 1) {
      throw new Error('No previous version to rollback to');
    }

    // The most recent history entry is the old value before the last change
    const previousValue = history[0].configValue;
    await this.set(key, previousValue, adminId, adminRole);

    logger.info(`Config rolled back: ${key} to ${previousValue} by admin ${adminId}`);
  }

  /**
   * Get config history for a key
   */
  async getHistory(key, limit = 20) {
    return db.select()
      .from(systemConfigHistory)
      .where(eq(systemConfigHistory.configKey, key))
      .orderBy(desc(systemConfigHistory.changedAt))
      .limit(limit);
  }

  /**
   * Get all configs (for admin dashboard)
   */
  async getAll() {
    return db.select().from(systemConfig);
  }

  /**
   * Get referral bonus for deposit amount
   */
  async getReferralBonus(depositAmount) {
    try {
      const tiers = await db.select()
        .from(referralTiers)
        .where(eq(referralTiers.isActive, true))
        .orderBy(asc(referralTiers.minDeposit));

      for (const tier of tiers) {
        const min = Number(tier.minDeposit);
        const max = tier.maxDeposit ? Number(tier.maxDeposit) : Infinity;

        if (depositAmount >= min && depositAmount <= max) {
          return Number(tier.bonusAmount);
        }
      }
      return 0;
    } catch (error) {
      logger.error('Error getting referral bonus from DB, using default tiers:', error);
      // Fail-safe: use hardcoded tiers
      const amount = Number(depositAmount);
      if (amount >= 500) return 30;
      if (amount >= 200) return 20;
      if (amount >= 100) return 10;
      if (amount >= 50) return 5;
      return 0;
    }
  }

  /**
   * Get all referral tiers
   */
  async getReferralTiers() {
    return db.select()
      .from(referralTiers)
      .orderBy(asc(referralTiers.minDeposit));
  }

  /**
   * Add or update a referral tier
   */
  async upsertReferralTier(tierData, adminId) {
    if (tierData.id) {
      const [updated] = await db.update(referralTiers)
        .set({
          minDeposit: String(tierData.minDeposit),
          maxDeposit: tierData.maxDeposit ? String(tierData.maxDeposit) : null,
          bonusAmount: String(tierData.bonusAmount),
          isActive: tierData.isActive !== false,
          updatedAt: new Date(),
        })
        .where(eq(referralTiers.id, tierData.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(referralTiers).values({
        minDeposit: String(tierData.minDeposit),
        maxDeposit: tierData.maxDeposit ? String(tierData.maxDeposit) : null,
        bonusAmount: String(tierData.bonusAmount),
        isActive: tierData.isActive !== false,
      }).returning();
      return created;
    }
  }

  /**
   * Delete a referral tier
   */
  async deleteReferralTier(tierId) {
    await db.delete(referralTiers).where(eq(referralTiers.id, tierId));
  }

  /**
   * Get all payment accounts
   */
  async getPaymentAccounts() {
    return db.select()
      .from(paymentAccounts)
      .orderBy(desc(paymentAccounts.priority));
  }

  /**
   * Get active payment account for a provider
   */
  async getActiveAccount(provider) {
    const accounts = await db.select()
      .from(paymentAccounts)
      .where(and(
        eq(paymentAccounts.provider, provider),
        eq(paymentAccounts.isActive, true),
      ))
      .orderBy(desc(paymentAccounts.priority))
      .limit(1);

    return accounts[0] || null;
  }

  /**
   * Add or update a payment account
   */
  async upsertPaymentAccount(accountData) {
    if (accountData.id) {
      const [updated] = await db.update(paymentAccounts)
        .set({
          provider: accountData.provider,
          accountNumber: accountData.accountNumber,
          accountName: accountData.accountName || null,
          isActive: accountData.isActive !== false,
          priority: accountData.priority || 0,
          dailyLimit: accountData.dailyLimit ? String(accountData.dailyLimit) : null,
          updatedAt: new Date(),
        })
        .where(eq(paymentAccounts.id, accountData.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(paymentAccounts).values({
        provider: accountData.provider,
        accountNumber: accountData.accountNumber,
        accountName: accountData.accountName || null,
        isActive: accountData.isActive !== false,
        priority: accountData.priority || 0,
        dailyLimit: accountData.dailyLimit ? String(accountData.dailyLimit) : null,
      }).returning();
      return created;
    }
  }

  /**
   * Delete a payment account
   */
  async deletePaymentAccount(accountId) {
    await db.delete(paymentAccounts).where(eq(paymentAccounts.id, accountId));
  }

  /**
   * Refresh cache from database and update fail-safe
   */
  async refreshCache() {
    if (this.isCacheValid()) return;

    try {
      const configs = await db.select().from(systemConfig);

      // Build new cache atomically to avoid race conditions
      const newCache = new Map();
      for (const config of configs) {
        const value = this.parseValue(config);
        newCache.set(config.configKey, value);
        this.lastKnownGood.set(config.configKey, value); // Update fail-safe
      }

      // Atomic swap - no window where cache is empty
      this.cache = newCache;
      this.lastRefresh = Date.now();
      logger.debug('Config cache refreshed');
    } catch (error) {
      logger.error('Error refreshing config cache:', error);
      // Don't throw - keep using last known good
    }
  }

  /**
   * Parse config value based on type
   */
  parseValue(config) {
    let value = config.configValue;

    if (config.valueType === 'number') {
      value = Number(value);
    } else if (config.valueType === 'boolean') {
      value = value === 'true' || value === true;
    } else if (config.valueType === 'json') {
      try {
        value = JSON.parse(value);
      } catch {
        logger.warn(`Failed to parse JSON config: ${config.configKey}`);
      }
    }

    return value;
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    return this.lastRefresh && (Date.now() - this.lastRefresh) < this.CACHE_TTL_MS;
  }

  /**
   * Force cache refresh (call after updates)
   */
  async forceRefresh() {
    this.lastRefresh = null;
    await this.refreshCache();
  }

  /**
   * Get a dynamic message template with placeholder replacement.
   * Usage: getMessage('msg_welcome') or getMessage('msg_deposit_telebirr', { telebirrNumber: '09...', minDeposit: 50 })
   * Falls back to defaultText if the key is not in DB.
   */
  async getMessage(key, placeholders = {}, defaultText = '') {
    const template = await this.get(key, defaultText);
    if (!template) return defaultText;

    // Replace {placeholder} tokens
    return String(template).replace(/\{(\w+)\}/g, (match, name) => {
      return placeholders[name] !== undefined ? placeholders[name] : match;
    });
  }

  /**
   * Subscribe to config changes (for hot reload)
   */
  onChange(callback) {
    this.on('config:changed', callback);
  }
}

// Singleton instance
const configService = new ConfigService();

// Initialize cache on startup (non-blocking)
configService.refreshCache().catch(err => {
  logger.error('Failed to initialize config cache:', err);
});

module.exports = configService;
