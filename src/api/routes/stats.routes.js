const { Router } = require('express');
const { eq, sql, gte, and } = require('drizzle-orm');
const { db } = require('../../database');
const { users, deposits, withdrawals } = require('../../database/schema');

const router = Router();

// GET /api/stats — Dashboard KPIs
router.get('/', async (req, res) => {
  try {
    const totalUsersRow = await db.select({ count: sql`count(*)` }).from(users);
    const totalUsers = Number(totalUsersRow[0].count);

    // Active in last 10 minutes
    const activeUsersRow = await db.select({ count: sql`count(*)` }).from(users)
      .where(sql`${users.lastActive} >= NOW() - INTERVAL '10 minutes'`);
    const activeUsers = Number(activeUsersRow[0].count);

    // Today's deposits
    const todayDepositsRow = await db.select({
      total: sql`COALESCE(SUM(${deposits.amount}), 0)`,
      count: sql`count(*)`
    }).from(deposits)
      .where(and(
        eq(deposits.status, 'approved'),
        sql`${deposits.processedAt} >= CURRENT_DATE`
      ));
    const depositsToday = Number(todayDepositsRow[0].total);

    // Today's withdrawals
    const todayWithdrawalsRow = await db.select({
      total: sql`COALESCE(SUM(${withdrawals.amount}), 0)`,
      count: sql`count(*)`
    }).from(withdrawals)
      .where(and(
        sql`${withdrawals.status} IN ('completed', 'approved')`,
        sql`${withdrawals.processedAt} >= CURRENT_DATE`
      ));
    const withdrawalsToday = Number(todayWithdrawalsRow[0].total);

    // Pending counts
    const pendingDepositsRow = await db.select({ count: sql`count(*)` }).from(deposits)
      .where(sql`${deposits.status} IN ('pending', 'under_review')`);
    const pendingDeposits = Number(pendingDepositsRow[0].count);

    const pendingWithdrawalsRow = await db.select({ count: sql`count(*)` }).from(withdrawals)
      .where(sql`${withdrawals.status} IN ('pending', 'under_review')`);
    const pendingWithdrawals = Number(pendingWithdrawalsRow[0].count);

    // All-time totals
    const totalDepositedRow = await db.select({ total: sql`COALESCE(SUM(${users.totalDeposited}), 0)` }).from(users);
    const totalWithdrawnRow = await db.select({ total: sql`COALESCE(SUM(${users.totalWithdrawn}), 0)` }).from(users);

    res.json({
      totalUsers,
      activeUsers,
      depositsToday,
      withdrawalsToday,
      platformProfit: depositsToday - withdrawalsToday,
      pendingDeposits,
      pendingWithdrawals,
      totalDeposited: Number(totalDepositedRow[0].total),
      totalWithdrawn: Number(totalWithdrawnRow[0].total),
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/stats/charts — 7-day chart data
router.get('/charts', async (req, res) => {
  try {
    // Deposits by day (last 7 days)
    const depositsResult = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'Mon DD') as date,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) as deposits
      FROM deposits
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY TO_CHAR(created_at, 'Mon DD'), DATE(created_at)
      ORDER BY DATE(created_at)
    `);
    const depositsByDay = depositsResult.rows || [];

    const withdrawalsResult = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'Mon DD') as date,
        COALESCE(SUM(CASE WHEN status IN ('completed', 'approved') THEN amount ELSE 0 END), 0) as withdrawals
      FROM withdrawals
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY TO_CHAR(created_at, 'Mon DD'), DATE(created_at)
      ORDER BY DATE(created_at)
    `);
    const withdrawalsByDay = withdrawalsResult.rows || [];

    const usersResult = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, 'Mon DD') as date,
        COUNT(*) as registrations
      FROM users
      WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY TO_CHAR(created_at, 'Mon DD'), DATE(created_at)
      ORDER BY DATE(created_at)
    `);
    const usersByDay = usersResult.rows || [];

    // Merge chart data
    const dateMap = new Map();
    const addToMap = (rows, key) => {
      for (const row of rows) {
        const existing = dateMap.get(row.date) || { date: row.date, deposits: 0, withdrawals: 0, registrations: 0 };
        existing[key] = Number(row[key]);
        dateMap.set(row.date, existing);
      }
    };

    addToMap(depositsByDay, 'deposits');
    addToMap(withdrawalsByDay, 'withdrawals');
    addToMap(usersByDay, 'registrations');

    const revenue = Array.from(dateMap.values());

    res.json({ revenue, registrations: Array.from(dateMap.values()) });
  } catch (error) {
    console.error('Charts error:', error);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

module.exports = router;
