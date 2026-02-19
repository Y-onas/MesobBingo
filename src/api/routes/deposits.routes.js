const { Router } = require('express');
const { eq, sql, desc } = require('drizzle-orm');
const { db } = require('../../database');
const { deposits, users, auditLogs } = require('../../database/schema');
const depositService = require('../../services/deposit.service');
const { notifyUser } = require('../telegram');

const router = Router();

// GET /api/deposits — list all deposits (optional ?status= filter)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = db
      .select({
        id: deposits.id,
        telegramId: deposits.telegramId,
        amount: deposits.amount,
        method: deposits.method,
        status: deposits.status,
        screenshotFileId: deposits.screenshotFileId,
        smsText: deposits.smsText,
        transactionRef: deposits.transactionRef,
        assignedAdmin: deposits.assignedAdmin,
        processedBy: deposits.processedBy,
        rejectionReason: deposits.rejectionReason,
        createdAt: deposits.createdAt,
        processedAt: deposits.processedAt,
        // Join user info
        username: users.username,
        firstName: users.firstName,
      })
      .from(deposits)
      .leftJoin(users, eq(deposits.telegramId, users.telegramId))
      .orderBy(desc(deposits.createdAt));

    if (status && status !== 'all') {
      query = query.where(eq(deposits.status, status));
    }

    const rows = await query;

    const result = rows.map(r => ({
      id: r.id,
      telegram_id: String(r.telegramId),
      username: r.username || r.firstName || `User ${r.telegramId}`,
      amount: Number(r.amount),
      payment_method: r.method,
      transaction_ref: r.transactionRef || '',
      screenshot_url: r.screenshotFileId || '',
      sms_text: r.smsText || '',
      created_at: r.createdAt,
      status: r.status,
      assigned_admin: r.assignedAdmin,
      rejection_reason: r.rejectionReason,
    }));

    res.json(result);
  } catch (error) {
    console.error('Deposits list error:', error);
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
});

// POST /api/deposits/:id/review — lock a deposit for review
router.post('/:id/review', async (req, res) => {
  try {
    const depositId = parseInt(req.params.id);
    const adminId = req.adminId;

    // Check if already locked
    const [dep] = await db.select().from(deposits).where(eq(deposits.id, depositId)).limit(1);
    if (!dep) return res.status(404).json({ error: 'Deposit not found' });
    if (dep.status !== 'pending') return res.status(400).json({ error: 'Deposit is not pending' });

    const [updated] = await db.update(deposits)
      .set({ status: 'under_review', assignedAdmin: adminId })
      .where(eq(deposits.id, depositId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Deposit review error:', error);
    res.status(500).json({ error: 'Failed to lock deposit' });
  }
});

// POST /api/deposits/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const depositId = parseInt(req.params.id);
    const adminId = req.adminId;
    const adminName = req.adminName;

    // Check if deposit is locked by another admin
    const [dep] = await db.select().from(deposits).where(eq(deposits.id, depositId)).limit(1);
    if (!dep) return res.status(404).json({ error: 'Deposit not found' });
    
    if (dep.status === 'under_review' && dep.assignedAdmin && dep.assignedAdmin !== adminId) {
      return res.status(403).json({ error: 'This deposit is locked by another admin' });
    }

    const result = await depositService.approveDeposit(depositId, adminId);

    // Log to audit
    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName,
      actionType: 'deposit_approved',
      targetUser: String(result.telegramId),
      amount: result.amount,
      ipAddress: req.adminIp,
    });

    res.json({ success: true, deposit: result });

    // Notify user via Telegram
    notifyUser(result.telegramId, `✅ *Deposit Approved!*\n\nYour deposit of *${Number(result.amount).toFixed(2)} ብር* has been approved!\n\nYour balance has been updated.`);
  } catch (error) {
    console.error('Deposit approve error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/deposits/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const depositId = parseInt(req.params.id);
    const { reason } = req.body;
    const adminId = req.adminId;
    const adminName = req.adminName;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Check if deposit is locked by another admin
    const [dep] = await db.select().from(deposits).where(eq(deposits.id, depositId)).limit(1);
    if (!dep) return res.status(404).json({ error: 'Deposit not found' });
    
    if (dep.status === 'under_review' && dep.assignedAdmin && dep.assignedAdmin !== adminId) {
      return res.status(403).json({ error: 'This deposit is locked by another admin' });
    }

    const result = await depositService.rejectDeposit(depositId, adminId, reason);

    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName,
      actionType: 'deposit_rejected',
      targetUser: String(result.telegramId),
      amount: result.amount,
      details: reason,
      ipAddress: req.adminIp,
    });

    res.json({ success: true, deposit: result });

    // Notify user via Telegram
    notifyUser(result.telegramId, `❌ *Deposit Rejected*\n\nYour deposit of *${Number(result.amount).toFixed(2)} ብር* was rejected.\n\nReason: ${reason}\n\nPlease contact support if you believe this is an error.`);
  } catch (error) {
    console.error('Deposit reject error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
