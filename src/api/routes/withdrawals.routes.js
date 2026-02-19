const { Router } = require('express');
const { eq, sql, desc } = require('drizzle-orm');
const { db } = require('../../database');
const { withdrawals, users, auditLogs } = require('../../database/schema');
const withdrawService = require('../../services/withdraw.service');
const { notifyUser } = require('../telegram');

const router = Router();

// GET /api/withdrawals — list all withdrawals with user financial info
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let query = db
      .select({
        id: withdrawals.id,
        telegramId: withdrawals.telegramId,
        amount: withdrawals.amount,
        method: withdrawals.method,
        accountNumber: withdrawals.accountNumber,
        status: withdrawals.status,
        assignedAdmin: withdrawals.assignedAdmin,
        processedBy: withdrawals.processedBy,
        rejectionReason: withdrawals.rejectionReason,
        createdAt: withdrawals.createdAt,
        processedAt: withdrawals.processedAt,
        // Join user info
        username: users.username,
        firstName: users.firstName,
        mainWallet: users.mainWallet,
        totalDeposited: users.totalDeposited,
        totalWithdrawn: users.totalWithdrawn,
        gamesPlayed: users.gamesPlayed,
        gamesWon: users.gamesWon,
      })
      .from(withdrawals)
      .leftJoin(users, eq(withdrawals.telegramId, users.telegramId))
      .orderBy(desc(withdrawals.createdAt));

    if (status && status !== 'all') {
      query = query.where(eq(withdrawals.status, status));
    }

    const rows = await query;

    const result = rows.map(r => ({
      id: r.id,
      telegram_id: String(r.telegramId),
      username: r.username || r.firstName || `User ${r.telegramId}`,
      amount: Number(r.amount),
      payment_method: r.method,
      account_details: r.accountNumber,
      created_at: r.createdAt,
      status: r.status === 'completed' ? 'approved' : r.status,
      assigned_admin: r.assignedAdmin,
      rejection_reason: r.rejectionReason,
      user_wallet: Number(r.mainWallet || 0),
      user_total_deposited: Number(r.totalDeposited || 0),
      user_total_withdrawn: Number(r.totalWithdrawn || 0),
      user_games_played: Number(r.gamesPlayed || 0),
      user_games_won: Number(r.gamesWon || 0),
    }));

    res.json(result);
  } catch (error) {
    console.error('Withdrawals list error:', error);
    res.status(500).json({ error: 'Failed to fetch withdrawals' });
  }
});

// POST /api/withdrawals/:id/review — lock a withdrawal for review
router.post('/:id/review', async (req, res) => {
  try {
    const withdrawalId = parseInt(req.params.id);
    const adminId = req.adminId;

    const [w] = await db.select().from(withdrawals).where(eq(withdrawals.id, withdrawalId)).limit(1);
    if (!w) return res.status(404).json({ error: 'Withdrawal not found' });
    if (w.status !== 'pending') return res.status(400).json({ error: 'Withdrawal is not pending' });

    const [updated] = await db.update(withdrawals)
      .set({ status: 'under_review', assignedAdmin: adminId })
      .where(eq(withdrawals.id, withdrawalId))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Withdrawal review error:', error);
    res.status(500).json({ error: 'Failed to lock withdrawal' });
  }
});

// POST /api/withdrawals/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const withdrawalId = parseInt(req.params.id);
    const adminId = req.adminId;
    const adminName = req.adminName;

    const result = await withdrawService.completeWithdrawal(withdrawalId, adminId);

    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName,
      actionType: 'withdrawal_approved',
      targetUser: String(result.telegramId),
      amount: result.amount,
      ipAddress: req.adminIp,
    });

    res.json({ success: true, withdrawal: result });

    // Notify user via Telegram
    notifyUser(result.telegramId, `✅ *Withdrawal Approved!*\n\nYour withdrawal of *${Number(result.amount).toFixed(2)} ብር* has been processed!\n\nThe funds will be sent to your account shortly.`);
  } catch (error) {
    console.error('Withdrawal approve error:', error);
    res.status(400).json({ error: error.message });
  }
});

// POST /api/withdrawals/:id/reject
router.post('/:id/reject', async (req, res) => {
  try {
    const withdrawalId = parseInt(req.params.id);
    const { reason } = req.body;
    const adminId = req.adminId;
    const adminName = req.adminName;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await withdrawService.rejectWithdrawal(withdrawalId, adminId, reason);

    await db.insert(auditLogs).values({
      adminId: String(adminId),
      adminName,
      actionType: 'withdrawal_rejected',
      targetUser: String(result.telegramId),
      amount: result.amount,
      details: reason,
      ipAddress: req.adminIp,
    });

    res.json({ success: true, withdrawal: result });

    // Notify user via Telegram
    notifyUser(result.telegramId, `❌ *Withdrawal Rejected*\n\nYour withdrawal of *${Number(result.amount).toFixed(2)} ብር* was rejected.\n\nReason: ${reason}\n\nThe amount has been refunded to your wallet.`);
  } catch (error) {
    console.error('Withdrawal reject error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
