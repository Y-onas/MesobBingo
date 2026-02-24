/**
 * Update deposit messages to include account names
 */

const { db } = require('../../src/database');
const { systemConfig } = require('../../src/database/schema');
const { eq } = require('drizzle-orm');

async function updateDepositMessages() {
  console.log('🔧 Updating deposit messages to include account names...\n');

  const telebirrMessage = `📱 *Telebirr Deposit*

1. Transfer money to: {telebirrNumber}
   Account Name: {telebirrName}
2. Take screenshot after transfer
3. Send screenshot here

⚠️ Minimum: {minDeposit} ብር`;

  const cbeMessage = `🏦 *CBE Deposit*

1. Deposit to Account: {cbeAccount}
   Account Name: {cbeAccountName}
2. Copy the SMS you receive
3. Paste and send the full SMS here

⚠️ Minimum: {minDeposit} ብር`;

  await db.transaction(async (tx) => {
    // Update Telebirr message
    console.log('1️⃣ Updating msg_deposit_telebirr...');
    const telebirrResult = await tx.update(systemConfig)
      .set({ configValue: telebirrMessage })
      .where(eq(systemConfig.configKey, 'msg_deposit_telebirr'))
      .returning({ configKey: systemConfig.configKey });

    if (telebirrResult.length === 0) {
      throw new Error("Row 'msg_deposit_telebirr' not found — was it seeded?");
    }
    console.log('   ✅ Updated Telebirr message');

    // Update CBE message
    console.log('\n2️⃣ Updating msg_deposit_cbe...');
    const cbeResult = await tx.update(systemConfig)
      .set({ configValue: cbeMessage })
      .where(eq(systemConfig.configKey, 'msg_deposit_cbe'))
      .returning({ configKey: systemConfig.configKey });

    if (cbeResult.length === 0) {
      throw new Error("Row 'msg_deposit_cbe' not found — was it seeded?");
    }
    console.log('   ✅ Updated CBE message');
  });

  console.log('\n✅ Deposit messages updated successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart the bot to pick up changes');
  console.log('   2. Test /deposit command in Telegram');
  console.log('   3. Verify account names are shown');
}

updateDepositMessages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error updating deposit messages:', error);
    process.exit(1);
  });
