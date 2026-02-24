const { Router } = require('express');
const { eq, sql, desc, or } = require('drizzle-orm');
const { db } = require('../../database');
const { users, auditLogs } = require('../../database/schema');
const userService = require('../../services/user.service');

const router = Router();

// GET /api/users — list users with optional search
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    
    let query;
    if (search && search.trim()) {
      const s = search.trim();
      const numSearch = parseInt(s);
      
      query = db.select().from(users)
        .where(
          or(
            sql`LOWER(${users.username}) LIKE LOWER(${'%' + s + '%'})`,
            sql`${users.phone} LIKE ${'%' + s + '%'}`,
            ...(isNaN(numSearch) ? [] : [eq(users.telegramId, numSearch)])
          )
        )
        .orderBy(desc(users.lastActive))
        .limit(100);
    } else {
      query = db.select().from(users).orderBy(desc(users.lastActive)).limit(100);
    }

    const rows = await query;

    const result = rows.map(u => ({
      id: String(u.telegramId),
      telegram_id: String(u.telegramId),
      username: u.username || u.firstName || `User ${u.telegramId}`,
      phone: u.phone || '',
      // New balance system
      withdrawable_balance: Number(u.withdrawableBalance || 0),
      playing_balance: Number(u.playingBalance || 0),
      total_winnings: Number(u.totalWinnings || 0),
      // Legacy fields (kept for backward compatibility)
      main_wallet: Number(u.mainWallet),
      bonus_wallet: Number(u.playWallet),
      total_deposited: Number(u.totalDeposited),
      total_withdrawn: Number(u.totalWithdrawn),
      deposit_count: Number(u.depositCount),
      games_played: Number(u.gamesPlayed),
      games_won: Number(u.gamesWon),
      referral_count: Number(u.referralCount),
      bonus_claimed: u.bonusClaimed,
      is_banned: u.isBanned,
      phone_verified: u.phoneVerified,
      created_at: u.createdAt,
      last_active: u.lastActive,
    }));

    res.json(result);
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/users/:telegramId — user profile
router.get('/:telegramId', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const user = await userService.getUser(telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: String(user.telegramId),
      telegram_id: String(user.telegramId),
      username: user.username || user.firstName || `User ${user.telegramId}`,
      phone: user.phone || '',
      // New balance system
      withdrawable_balance: Number(user.withdrawableBalance || 0),
      playing_balance: Number(user.playingBalance || 0),
      total_winnings: Number(user.totalWinnings || 0),
      // Legacy fields (kept for backward compatibility)
      main_wallet: Number(user.mainWallet),
      bonus_wallet: Number(user.playWallet),
      total_deposited: Number(user.totalDeposited),
      total_withdrawn: Number(user.totalWithdrawn),
      deposit_count: Number(user.depositCount),
      games_played: Number(user.gamesPlayed),
      games_won: Number(user.gamesWon),
      referral_count: Number(user.referralCount),
      bonus_claimed: user.bonusClaimed,
      is_banned: user.isBanned,
      phone_verified: user.phoneVerified,
      created_at: user.createdAt,
      last_active: user.lastActive,
    });
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/users/:telegramId/ban — toggle ban
router.post('/:telegramId/ban', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const user = await userService.getUser(telegramId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updated = await userService.setBanned(telegramId, !user.isBanned);

    await db.insert(auditLogs).values({
      adminId: req.adminId,
      adminName: req.adminName,
      actionType: user.isBanned ? 'user_unbanned' : 'user_banned',
      targetUser: String(telegramId),
      ipAddress: req.adminIp,
    });

    res.json({ success: true, is_banned: updated.isBanned });
  } catch (error) {
    console.error('User ban error:', error);
    res.status(500).json({ error: 'Failed to toggle ban' });
  }
});

// POST /api/users/:telegramId/adjust-wallet — adjust wallet balance
router.post('/:telegramId/adjust-wallet', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const { amount, reason } = req.body;

    if (!amount || !reason || !reason.trim()) {
      return res.status(400).json({ error: 'Amount and reason are required' });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) return res.status(400).json({ error: 'Invalid amount' });

    // Update both withdrawable_balance and main_wallet atomically (new balance model)
    const { pool } = require('../../database');
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        'UPDATE users SET withdrawable_balance = withdrawable_balance + $1, main_wallet = main_wallet + $1 WHERE telegram_id = $2 RETURNING withdrawable_balance, main_wallet',
        [numAmount, telegramId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      
      await client.query('COMMIT');
      
      const updated = result.rows[0];

      await db.insert(auditLogs).values({
        adminId: req.adminId,
        adminName: req.adminName,
        actionType: 'wallet_adjusted',
        targetUser: String(telegramId),
        amount: String(Math.abs(numAmount)),
        details: `${numAmount > 0 ? '+' : ''}${numAmount} — ${reason}`,
        ipAddress: req.adminIp,
      });

      res.json({ 
        success: true, 
        new_balance: Number(updated.main_wallet),
        withdrawable_balance: Number(updated.withdrawable_balance)
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Wallet adjust error:', error);
    res.status(500).json({ error: 'Failed to adjust wallet' });
  }
});

// POST /api/users/:telegramId/reset-bonus
router.post('/:telegramId/reset-bonus', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const [updated] = await db.update(users)
      .set({ bonusClaimed: false })
      .where(eq(users.telegramId, telegramId))
      .returning();

    await db.insert(auditLogs).values({
      adminId: req.adminId,
      adminName: req.adminName,
      actionType: 'bonus_reset',
      targetUser: String(telegramId),
      ipAddress: req.adminIp,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Reset bonus error:', error);
    res.status(500).json({ error: 'Failed to reset bonus' });
  }
});

// POST /api/users/:telegramId/verify-phone
router.post('/:telegramId/verify-phone', async (req, res) => {
  try {
    const telegramId = parseInt(req.params.telegramId);
    const [updated] = await db.update(users)
      .set({ phoneVerified: true })
      .where(eq(users.telegramId, telegramId))
      .returning();

    await db.insert(auditLogs).values({
      adminId: req.adminId,
      adminName: req.adminName,
      actionType: 'phone_verified',
      targetUser: String(telegramId),
      ipAddress: req.adminIp,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Verify phone error:', error);
    res.status(500).json({ error: 'Failed to verify phone' });
  }
});

module.exports = router;
