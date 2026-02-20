# Scripts Directory

Utility scripts for database management, testing, and maintenance.

## Directory Structure

```
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

### test-token.js
Tests JWT token generation and verification.

```bash
node scripts/checks/test-token.js
```

## Fix Scripts

Located in `scripts/fixes/`

These are one-time fix scripts for specific issues. Run only when needed.

### fix-game-schema.js
Fixes game schema inconsistencies.

```bash
node scripts/fixes/fix-game-schema.js
```

### fix-withdrawal-status.js
Fixes withdrawal status issues.

```bash
node scripts/fixes/fix-withdrawal-status.js
```

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
