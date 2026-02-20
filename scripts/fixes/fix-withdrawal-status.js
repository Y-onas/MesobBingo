/**
 * Fix withdrawal status: change 'completed' to 'approved' to match schema
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true 
  }
});

async function fixWithdrawalStatus() {
  console.log('🔄 Fixing withdrawal status from "completed" to "approved"...\n');

  const client = await pool.connect();
  try {
    // Check how many records need updating
    const checkResult = await client.query(
      `SELECT COUNT(*) as count FROM withdrawals WHERE status = 'completed'`
    );
    const count = parseInt(checkResult.rows[0].count);

    if (count === 0) {
      console.log('✅ No records to update. All withdrawals already use "approved" status.');
      return;
    }

    console.log(`Found ${count} withdrawal(s) with status "completed"`);
    console.log('Updating to "approved"...\n');

    // Update the records
    const updateResult = await client.query(
      `UPDATE withdrawals SET status = 'approved' WHERE status = 'completed' RETURNING id`
    );

    console.log(`✅ Updated ${updateResult.rowCount} withdrawal(s)`);
    console.log('\nUpdated withdrawal IDs:', updateResult.rows.map(r => r.id).join(', '));
    console.log('\n✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixWithdrawalStatus();
