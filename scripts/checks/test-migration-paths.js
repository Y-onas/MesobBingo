/**
 * Test migration script paths
 * Verifies that all migration scripts can locate their required files
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Migration Script Paths\n');
console.log('═'.repeat(60));

let allPassed = true;

// Test 1: run-validation-migration.js path
console.log('\nTest 1: run-validation-migration.js SQL file path');
console.log('-'.repeat(60));

const validationScriptDir = path.join(__dirname, '..', 'migrations');
const expectedSqlPath = path.resolve(validationScriptDir, '..', '..', 'drizzle', '0004_add_multi_winner_support.sql');

console.log(`Script directory: ${validationScriptDir}`);
console.log(`Expected SQL path: ${expectedSqlPath}`);

if (fs.existsSync(expectedSqlPath)) {
  console.log('✅ PASS - SQL file found at correct location');
} else {
  console.log('❌ FAIL - SQL file not found');
  allPassed = false;
}

// Test 2: Verify all drizzle migration files exist
console.log('\nTest 2: Verify all drizzle migration files');
console.log('-'.repeat(60));

const drizzleDir = path.join(__dirname, '..', '..', 'drizzle');
const expectedMigrations = [
  '0000_init_schema.sql',
  '0001_chilly_squadron_sinister.sql',
  '0002_add_sms_text_field.sql',
  '0002_left_rockslide.sql',
  '0003_add_game_tables.sql',
  '0004_add_multi_winner_support.sql',
  '0005_add_dynamic_win_percentage.sql'
];

let migrationsPassed = true;
for (const migration of expectedMigrations) {
  const migrationPath = path.join(drizzleDir, migration);
  if (fs.existsSync(migrationPath)) {
    console.log(`✅ ${migration}`);
  } else {
    console.log(`❌ ${migration} - NOT FOUND`);
    migrationsPassed = false;
    allPassed = false;
  }
}

if (migrationsPassed) {
  console.log('\n✅ All migration files found');
}

// Test 3: Verify migration scripts exist
console.log('\nTest 3: Verify migration scripts exist');
console.log('-'.repeat(60));

const migrationScripts = [
  'run-migration.js',
  'run-game-migration.js',
  'run-validation-migration.js',
  'run-win-percentage-migration.js'
];

let scriptsPassed = true;
for (const script of migrationScripts) {
  const scriptPath = path.join(__dirname, '..', 'migrations', script);
  if (fs.existsSync(scriptPath)) {
    console.log(`✅ ${script}`);
  } else {
    console.log(`❌ ${script} - NOT FOUND`);
    scriptsPassed = false;
    allPassed = false;
  }
}

if (scriptsPassed) {
  console.log('\n✅ All migration scripts found');
}

// Summary
console.log('\n' + '═'.repeat(60));
if (allPassed) {
  console.log('\n✅ All path tests passed!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some path tests failed\n');
  process.exit(1);
}
