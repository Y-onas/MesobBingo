const { Router } = require('express');
const { desc, sql } = require('drizzle-orm');
const { db } = require('../../database');
const { auditLogs } = require('../../database/schema');

const router = Router();

// GET /api/audit-logs — paginated audit logs
router.get('/', async (req, res) => {
  try {
    const { search, limit = 50, offset = 0 } = req.query;

    let query = db.select().from(auditLogs).orderBy(desc(auditLogs.timestamp));

    if (search && search.trim()) {
      const s = search.trim().toLowerCase();
      query = query.where(
        sql`LOWER(${auditLogs.adminName}) LIKE ${'%' + s + '%'} 
            OR LOWER(${auditLogs.actionType}) LIKE ${'%' + s + '%'} 
            OR LOWER(COALESCE(${auditLogs.targetUser}, '')) LIKE ${'%' + s + '%'}`
      );
    }

    const rows = await query.limit(parseInt(limit)).offset(parseInt(offset));

    const result = rows.map(log => ({
      id: log.id,
      admin_id: log.adminId,
      admin_name: log.adminName,
      action_type: log.actionType,
      target_user: log.targetUser || '',
      amount: log.amount ? Number(log.amount) : undefined,
      timestamp: log.timestamp,
      ip_address: log.ipAddress || '',
      details: log.details || '',
    }));

    res.json(result);
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
