/**
 * Update deposit messages to include account names
 */

const { db } = require('../../src/database');
const { systemConfig } = require('../../src/database/schema');
const { eq } = require('drizzle-orm');

async function updateDepositMessages() {
  console.log('🔧 Updating deposit messages to include account names...\n');

  try {
    // Update Telebirr message
    console.log('1️⃣ Updating msg_deposit_telebirr...');
    const telebirrMessage = `📱 *Telebirr Deposit*

1. Transfer money to: {telebirrNumber}
   Account Name: {telebirrName}
2. Take screenshot after transfer
3. Send screenshot here

⚠️ Minimum: {minDeposit} ብር`;

    await db.update(systemConfig)
      .set({ configValue: telebirrMessage })
      .where(eq(systemConfig.configKey, 'msg_deposit_telebirr'));
    
    console.log('   ✅ Updated Telebirr message');

    // Update CBE message
    console.log('\n2️⃣ Updating msg_deposit_cbe...');
    const cbeMessage = `🏦 *CBE Deposit*

1. Deposit to Account: {cbeAccount}
   Account Name: {cbeAccountName}
2. Copy the SMS you receive
3. Paste and send the full SMS here

⚠️ Minimum: {minDeposit} ብር`;

    await db.update(systemConfig)
      .set({ configValue: cbeMessage })
      .where(eq(systemConfig.configKey, 'msg_deposit_cbe'));
    
    console.log('   ✅ Updated CBE message');

    console.log('\n✅ Deposit messages updated successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the bot to pick up changes');
    console.log('   2. Test /deposit command in Telegram');
    console.log('   3. Verify account names are shown');

  } catch (error) {
    console.error('❌ Error updating deposit messages:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

updateDepositMessages();
