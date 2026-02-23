/**
 * Add account name configuration keys
 * Adds telebirr_account_name and cbe_account_name to system_config
 */

const { db } = require('../../src/database');
const { systemConfig } = require('../../src/database/schema');
const { eq } = require('drizzle-orm');

async function addAccountNameConfigs() {
  console.log('🔧 Adding account name configuration keys...\n');

  try {
    // Check if configs already exist
    const existing = await db.select()
      .from(systemConfig)
      .where(eq(systemConfig.configKey, 'telebirr_account_name'));

    if (existing.length > 0) {
      console.log('✅ Account name configs already exist');
      process.exit(0);
    }

    // Add telebirr_account_name
    await db.insert(systemConfig).values({
      configKey: 'telebirr_account_name',
      configValue: 'Mesob Bingo',
      valueType: 'string',
      category: 'payment',
      description: 'Company name for Telebirr account (shown to users during deposit)',
    });
    console.log('✅ Added: telebirr_account_name');

    // Add cbe_account_name
    await db.insert(systemConfig).values({
      configKey: 'cbe_account_name',
      configValue: 'Mesob Bingo',
      valueType: 'string',
      category: 'payment',
      description: 'Company name for CBE account (shown to users during deposit)',
    });
    console.log('✅ Added: cbe_account_name');

    console.log('\n✅ Account name configs added successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Go to Dashboard → Settings → Configuration');
    console.log('   2. Find "telebirr_account_name" and "cbe_account_name" in Payment section');
    console.log('   3. Update them with your actual company name');
    console.log('   4. Restart the bot to pick up changes');

  } catch (error) {
    console.error('❌ Error adding account name configs:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

addAccountNameConfigs();
