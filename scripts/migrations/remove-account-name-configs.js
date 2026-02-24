#!/usr/bin/env node
/**
 * Remove obsolete account name configs from system_config
 * These are now managed via payment_accounts.account_name field
 */

require('dotenv').config();
const { db } = require('../../src/database');
const { systemConfig } = require('../../src/database/schema');
const { inArray } = require('drizzle-orm');

async function removeAccountNameConfigs() {
  console.log('🗑️  Removing obsolete account name configs...\n');

  try {
    // Remove telebirr_account_name and cbe_account_name
    const result = await db.delete(systemConfig)
      .where(inArray(systemConfig.configKey, ['telebirr_account_name', 'cbe_account_name']))
      .returning();

    if (result.length > 0) {
      console.log('✅ Removed obsolete configs:');
      result.forEach(config => {
        console.log(`   - ${config.configKey}`);
      });
    } else {
      console.log('ℹ️  No obsolete configs found (already removed)');
    }

    console.log('\n✅ Migration complete!');
    console.log('\n📝 These configs are now managed via:');
    console.log('   Dashboard → Settings → Payment Accounts → Account Name field');
    console.log('\n💡 Each payment account has its own account_name field');
    console.log('   The bot automatically uses the name from the active account');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

removeAccountNameConfigs();
