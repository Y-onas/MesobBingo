const { Router } = require('express');
const { eq, desc } = require('drizzle-orm');
const { db, pool } = require('../../database');
const { fraudAlerts, auditLogs } = require('../../database/schema');

const router = Router();

// GET /api/fraud-alerts — list all fraud alerts
router.get('/', async (req, res) => {
  try {
    const rows = await db.select().from(fraudAlerts).orderBy(desc(fraudAlerts.createdAt));

    const result = rows.map(alert => ({
      id: alert.id,
      alert_type: alert.alertType,
      user_id: String(alert.telegramId),
      username: alert.username || `User ${alert.telegramId}`,
      telegram_id: String(alert.telegramId),
      risk_score: alert.riskScore,
      description: alert.description || '',
      created_at: alert.createdAt,
      resolved: alert.resolved,
    }));

    res.json(result);
  } catch (error) {
    console.error('Fraud alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch fraud alerts' });
  }
});

// POST /api/fraud-alerts/:id/resolve — resolve an alert
router.post('/:id/resolve', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const alertId = parseInt(req.params.id);

    // Update alert
    const updateResult = await client.query(
      `UPDATE fraud_alerts 
       SET resolved = true, resolved_by = $1 
       WHERE id = $2 
       RETURNING *`,
      [req.adminId, alertId]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Alert not found' });
    }

    const updated = updateResult.rows[0];

    // Insert audit log
    await client.query(
      `INSERT INTO audit_logs (admin_id, admin_name, action_type, target_user, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.adminId,
        req.adminName,
        'fraud_alert_resolved',
        String(updated.telegram_id),
        `Alert: ${updated.alert_type}`,
        req.adminIp
      ]
    );

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  } finally {
    client.release();
  }
});

module.exports = router;
