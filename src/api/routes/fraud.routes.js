const { Router } = require('express');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../../database');
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
  try {
    const alertId = parseInt(req.params.id);

    const [updated] = await db.update(fraudAlerts)
      .set({ resolved: true, resolvedBy: req.adminId })
      .where(eq(fraudAlerts.id, alertId))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Alert not found' });

    await db.insert(auditLogs).values({
      adminId: req.adminId,
      adminName: req.adminName,
      actionType: 'fraud_alert_resolved',
      targetUser: String(updated.telegramId),
      details: `Alert: ${updated.alertType}`,
      ipAddress: req.adminIp,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

module.exports = router;
