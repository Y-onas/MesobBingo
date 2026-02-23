const { db } = require('../../src/database');
const { systemConfig } = require('../../src/database/schema');
const { eq } = require('drizzle-orm');

async function addBotUsernameConfig() {
  try {
    console.log('Adding bot_username to system config...');

    // Check if it already exists
    const existing = await db.select()
      .from(systemConfig)
      .where(eq(systemConfig.configKey, 'bot_username'))
      .limit(1);

    if (existing.length > 0) {
      console.log('✅ bot_username config already exists');
      console.log('⚠️  Set the value in Dashboard → Settings page');
      return;
    }

    // Insert bot_username config with empty value
    // Admin will set the actual value via dashboard
    await db.insert(systemConfig).values({
      configKey: 'bot_username',
      configValue: '', // Empty - set via dashboard
      valueType: 'string',
      category: 'features',
      description: 'Telegram bot username (without @) for broadcast deep links',
    });

    console.log('✅ Successfully added bot_username config');
    console.log('⚠️  IMPORTANT: Set bot_username in Dashboard → Settings page');
  } catch (error) {
    console.error('❌ Error adding bot_username config:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

addBotUsernameConfig();
