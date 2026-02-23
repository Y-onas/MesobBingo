#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('../../src/database');

/**
 * Update balance message template to show new balance breakdown
 */
async function updateBalanceMessage() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Updating balance message template...\n');
    
    const newTemplate = `💰 *YOUR BALANCE*

✅ *Withdrawable:* {withdrawable} ብር
   (Real winnings - can withdraw)

🎮 *Playing Balance:* {playing} ብር
   (Deposits & bonuses - must play)

━━━━━━━━━━━━━━━━━━━━━━
💵 *Total:* {total} ብር`;

    const { rows } = await client.query(
      `UPDATE system_config 
       SET config_value = $1, updated_at = NOW() 
       WHERE config_key = 'msg_balance'
       RETURNING *`,
      [newTemplate]
    );
    
    if (rows.length > 0) {
      console.log('✅ Balance message updated successfully!\n');
      console.log('New template:');
      console.log(newTemplate);
    } else {
      console.log('⚠️  msg_balance config not found. Creating it...\n');
      
      await client.query(
        `INSERT INTO system_config (config_key, config_value, value_type, category, description)
         VALUES ('msg_balance', $1, 'string', 'messages', 'Balance command message template')`,
        [newTemplate]
      );
      
      console.log('✅ Balance message created successfully!');
    }
    
  } catch (error) {
    console.error('❌ Error updating balance message:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

updateBalanceMessage().catch(console.error);
