# Scripts Directory

Utility scripts for database management, testing, and maintenance.

## Directory Structure

```text
scripts/
├── migrations/     # Database migration scripts
├── checks/         # Verification and testing scripts
└── fixes/          # One-time fix scripts
```

## Migration Scripts

Located in `scripts/migrations/`

### run-migration.js
Adds `sms_text` column to deposits table.

```bash
node scripts/migrations/run-migration.js
```

### run-game-migration.js
Creates game-related tables (games, boards, game_players, called_numbers).

```bash
node scripts/migrations/run-game-migration.js
```

### run-validation-migration.js
Adds multi-winner support and false claim tracking.

```bash
node scripts/migrations/run-validation-migration.js
```

### run-win-percentage-migration.js
Creates win_percentage_rules table and adds use_dynamic_percentage column.

```bash
node scripts/migrations/run-win-percentage-migration.js
```

## Check Scripts

Located in `scripts/checks/`

### test-system.js
Comprehensive system test for all components (Bot API, Admin Dashboard, Web Game).

**Environment Variables Required:**
- `ADMIN_API_KEY` - Admin API key for authentication
- `ADMIN_ID` or `ADMIN_IDS` - Admin Telegram ID(s)
- `API_BASE` (optional) - API base URL (default: http://localhost:3001)

```bash
node scripts/checks/test-system.js
```

Tests:
- Health endpoint
- Admin authentication
- Deposits API
- Withdrawals API
- Users API
- Stats API
- Web game
- Dashboard
- Bot status

### check-win-rules-table.js
Verifies win_percentage_rules table exists and shows its structure.

```bash
node scripts/checks/check-win-rules-table.js
```

Shows:
- Table existence
- Column structure
- Indexes
- Foreign keys
- Existing rules

### check-tables.js
Checks database table structure.

```bash
node scripts/checks/check-tables.js
```

### check-rooms.js
Verifies game rooms configuration.

```bash
node scripts/checks/check-rooms.js
```

### check-game-columns.js
Validates game table columns.

```bash
node scripts/checks/check-game-columns.js
```

### check-dynamic-percentage.js
Checks dynamic win percentage configuration.

```bash
node scripts/checks/check-dynamic-percentage.js
```

### test-db-connection.js
Tests database connection health (Neon HTTP, pg Pool, table access).

```bash
node scripts/checks/test-db-connection.js
```

Shows:
- Neon HTTP driver status
- pg Pool connection status
- Table access verification
- Server time and version

### diagnose-db-errors.js
Diagnoses database connection issues and tests rapid writes.

```bash
node scripts/checks/diagnose-db-errors.js
```

Shows:
- Active games count
- Connection pool status
- Rapid write test results
- Simulates game calling behavior

### test-neon-http-writes.js
Tests Neon HTTP driver with game-like write patterns.

```bash
node scripts/checks/test-neon-http-writes.js
```

Simulates:
- Rapid number calls (10 iterations)
- 2-second intervals between calls
- Insert and update operations
- Measures write latency

### test-exit-codes.js
Tests script exit codes for CI/CD integration.

```bash
node scripts/checks/test-exit-codes.js
```

### test-migration-paths.js
Tests migration file paths and structure.

```bash
node scripts/checks/test-migration-paths.js
```

### test-token.js
Tests JWT token generation and verification.

```bash
node scripts/checks/test-token.js
```

## Fix Scripts

Located in `scripts/fixes/`

These are one-time fix scripts for specific issues. Run only when needed.

⚠️ **WARNING**: Fix scripts can modify or delete data. Use with caution!

### fix-game-schema.js
Fixes game schema inconsistencies by dropping and recreating tables.

**⚠️ DANGER**: This script drops all game tables and data!

**Safety Features:**
- Blocks execution in production without explicit confirmation
- Requires `CONFIRM_GAME_SCHEMA_RESET=true` in production
- Shows warnings before execution

```bash
# Development (with warning)
node scripts/fixes/fix-game-schema.js

# Production (requires confirmation)
NODE_ENV=production CONFIRM_GAME_SCHEMA_RESET=true node scripts/fixes/fix-game-schema.js
```

### fix-withdrawal-status.js
Fixes withdrawal status issues (changes 'completed' to 'approved').

**Safety Features:**
- Shows warning in production
- Only updates status values (non-destructive)
- Shows count before updating

```bash
node scripts/fixes/fix-withdrawal-status.js
```

### update-winner-window.js
Updates winner time window configuration for game rooms.

```bash
node scripts/fixes/update-winner-window.js
```

### enable-dynamic-percentage.js
Enables dynamic win percentage for game rooms.

```bash
node scripts/fixes/enable-dynamic-percentage.js
```

### cleanup-stuck-games.js
Cleans up games stuck in "playing" status for more than 2 hours.

**What it does:**
- Finds games in "playing" status older than 2 hours
- Marks them as "completed" with finished_at timestamp
- Prevents database load from abandoned games

**Safety Features:**
- Read-only scan first (shows what will be cleaned)
- Only updates status and timestamp
- Non-destructive (doesn't delete data)

```bash
node scripts/fixes/cleanup-stuck-games.js
```

**When to use:**
- After server crashes or restarts
- When database errors indicate stuck games
- As weekly maintenance task
- When monitoring shows high active game count

## Usage Notes

1. **Migrations**: Run in order if setting up a new database
2. **Checks**: Run anytime to verify system health
3. **Fixes**: Run only when specific issues are identified

## Environment Requirements

All scripts require:
- `.env` file with `DATABASE_URL` configured
- Node.js dependencies installed (`npm install`)
- Database connection available

## Safety

- Migration scripts use `IF NOT EXISTS` / `IF EXISTS` clauses for safety
- Check scripts are read-only and safe to run anytime
- Fix scripts should be reviewed before running
