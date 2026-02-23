-- ─── Dynamic Configuration Migration ──────────────────────────────────
-- Moves hardcoded business rules from .env to database
-- Supports: validation, versioning, rollback, hot reload, kill switches

-- ─── System Configuration Table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_config (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL,        -- 'string', 'number', 'boolean', 'json'
  category VARCHAR(50) NOT NULL,           -- 'payment', 'limits', 'bonuses', 'game', 'features'
  description TEXT,
  updated_by BIGINT,                       -- admin telegram_id
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ─── Config History (Versioning + Rollback) ──────────────────────────
CREATE TABLE IF NOT EXISTS system_config_history (
  id SERIAL PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT NOT NULL,
  value_type VARCHAR(20) NOT NULL,
  category VARCHAR(50) NOT NULL,
  changed_by BIGINT NOT NULL,              -- admin telegram_id
  changed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_config_history_key_time
  ON system_config_history(config_key, changed_at DESC);

-- ─── Referral Bonus Tiers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_tiers (
  id SERIAL PRIMARY KEY,
  min_deposit NUMERIC(12, 2) NOT NULL,
  max_deposit NUMERIC(12, 2),              -- NULL = no upper limit
  bonus_amount NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_tiers_deposit_range
  ON referral_tiers(min_deposit, max_deposit)
  WHERE is_active = TRUE;

-- ─── Payment Accounts (for rotation) ────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_accounts (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(20) NOT NULL,            -- 'telebirr', 'cbe'
  account_number VARCHAR(50) NOT NULL,
  account_name VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  priority INTEGER DEFAULT 0,               -- Higher = preferred
  daily_limit NUMERIC(12, 2),
  current_daily_total NUMERIC(12, 2) DEFAULT 0,
  last_reset_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_accounts_active
  ON payment_accounts(provider, is_active, priority DESC)
  WHERE is_active = TRUE;

-- ─── Seed Initial Configuration ──────────────────────────────────────

-- Payment Limits
INSERT INTO system_config (config_key, config_value, value_type, category, description) VALUES
  ('min_deposit', '50', 'number', 'payment', 'Minimum deposit amount in Birr'),
  ('min_withdraw', '150', 'number', 'payment', 'Minimum withdrawal amount in Birr'),
  ('telebirr_number', '0900000000', 'string', 'payment', 'Primary Telebirr account number'),
  ('cbe_account', '1000000000000', 'string', 'payment', 'Primary CBE account number')
ON CONFLICT (config_key) DO NOTHING;

-- Bonuses
INSERT INTO system_config (config_key, config_value, value_type, category, description) VALUES
  ('welcome_bonus', '5', 'number', 'bonuses', 'Welcome bonus for phone verification (Birr)')
ON CONFLICT (config_key) DO NOTHING;

-- Game Configuration
INSERT INTO system_config (config_key, config_value, value_type, category, description) VALUES
  ('game_stakes', '[5,10,20,50,100]', 'json', 'game', 'Available game stake amounts'),
  ('number_call_interval_ms', '2000', 'number', 'game', 'Interval between number calls in milliseconds'),
  ('countdown_seconds', '120', 'number', 'game', 'Game countdown duration in seconds'),
  ('boards_per_game', '200', 'number', 'game', 'Number of pre-generated boards per game')
ON CONFLICT (config_key) DO NOTHING;

-- Connection Limits
INSERT INTO system_config (config_key, config_value, value_type, category, description) VALUES
  ('max_connections_per_user', '2', 'number', 'limits', 'Maximum simultaneous connections per user'),
  ('max_connections_per_ip', '5', 'number', 'limits', 'Maximum simultaneous connections per IP address'),
  ('max_total_connections', '1000', 'number', 'limits', 'Maximum total connections')
ON CONFLICT (config_key) DO NOTHING;

-- Kill Switches (Feature Flags)
INSERT INTO system_config (config_key, config_value, value_type, category, description) VALUES
  ('deposits_enabled', 'true', 'boolean', 'features', 'Enable/disable deposit functionality'),
  ('withdrawals_enabled', 'true', 'boolean', 'features', 'Enable/disable withdrawal functionality'),
  ('games_enabled', 'true', 'boolean', 'features', 'Enable/disable game functionality')
ON CONFLICT (config_key) DO NOTHING;

-- ─── Seed Referral Tiers ─────────────────────────────────────────────
INSERT INTO referral_tiers (min_deposit, max_deposit, bonus_amount) VALUES
  (50, 99.99, 5),
  (100, 199.99, 10),
  (200, 499.99, 20),
  (500, NULL, 30);

-- ─── Seed Payment Accounts ───────────────────────────────────────────
INSERT INTO payment_accounts (provider, account_number, is_active, priority) VALUES
  ('telebirr', '0900000000', true, 1),
  ('cbe', '1000000000000', true, 1);
