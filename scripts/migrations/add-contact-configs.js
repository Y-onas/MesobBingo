#!/usr/bin/env node
/**
 * Migration: Add channel_id, channel_url, support_username to system_config
 * 
 * These were previously hardcoded in .env but should be dynamic
 * so admins can change them from the dashboard without restart.
 */

const { db } = require('../../src/database/index.js');
const { systemConfig } = require('../../src/database/schema.js');
const { eq } = require('drizzle-orm');

async function migrate() {
  console.log('🔄 Adding contact configuration keys to system_config...\n');

  const configs = [
    {
      configKey: 'channel_id',
      configValue: '@mesob_bingo_official',
      valueType: 'string',
      category: 'features',
      description: 'Telegram channel ID (with @)',
    },
    {
      configKey: 'channel_url',
      configValue: 'https://t.me/mesob_bingo_official',
      valueType: 'string',
      category: 'features',
      description: 'Telegram channel URL',
    },
    {
      configKey: 'support_username',
      configValue: '@mesobbingosupport',
      valueType: 'string',
      category: 'features',
      description: 'Support Telegram username (with @)',
    },
  ];

  let hadErrors = false;
  for (const config of configs) {
    try {
      // Check if exists
      const existing = await db
        .select()
        .from(systemConfig)
        .where(eq(systemConfig.configKey, config.configKey))
        .limit(1);

      if (existing.length > 0) {
        console.log(`✅ ${config.configKey} already exists (value: ${existing[0].configValue})`);
      } else {
        // Insert new config
        await db.insert(systemConfig).values(config);
        console.log(`✅ Added ${config.configKey} = ${config.configValue}`);
      }
    } catch (err) {
      console.error(`❌ Error adding ${config.configKey}:`, err.message);
      hadErrors = true;
    }
  }

  console.log('\n✅ Migration complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Go to Admin Dashboard → Settings');
  console.log('2. Find these new configs under "Kill Switches" category');
  console.log('3. Update values as needed');
  console.log('4. Changes apply immediately (no restart needed)');
  
  process.exit(hadErrors ? 1 : 0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
