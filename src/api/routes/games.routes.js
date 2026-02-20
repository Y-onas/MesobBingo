const { Router } = require('express');
const { eq, desc, and, sql } = require('drizzle-orm');
const { db } = require('../../database');
const { gameRooms, winPercentageRules, auditLogs } = require('../../database/schema');
const { validateRules } = require('../../services/win-percentage.service');
const logger = require('../../utils/logger');

const router = Router();

// GET /api/game-rooms — list all rooms
router.get('/', async (req, res) => {
  try {
    const rows = await db.select().from(gameRooms).orderBy(desc(gameRooms.createdAt));

    const result = rows.map(room => ({
      id: room.id,
      name: room.name,
      entry_fee: Number(room.entryFee),
      min_players: room.minPlayers,
      max_players: room.maxPlayers,
      current_players: room.currentPlayers,
      countdown_time: room.countdownTime,
      winning_percentage: room.winningPercentage,
      use_dynamic_percentage: room.useDynamicPercentage,
      total_pot: Number(room.totalPot),
      expected_payout: Number(room.expectedPayout),
      commission: Number(room.commission),
      status: room.status,
      created_at: room.createdAt,
    }));

    res.json(result);
  } catch (error) {
    console.error('Game rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch game rooms' });
  }
});

// POST /api/game-rooms — create a new room
router.post('/', async (req, res) => {
  try {
    const { name, entry_fee, min_players, max_players, countdown_time, winning_percentage } = req.body;

    if (!name || !entry_fee) {
      return res.status(400).json({ error: 'Room name and entry fee are required' });
    }

    const fee = parseFloat(entry_fee);
    const [room] = await db.insert(gameRooms).values({
      name,
      entryFee: String(fee),
      minPlayers: parseInt(min_players) || 5,
      maxPlayers: parseInt(max_players) || 20,
      countdownTime: parseInt(countdown_time) || 120,
      winningPercentage: parseInt(winning_percentage) || 75,
      status: 'waiting',
    }).returning();

    res.json({
      id: room.id,
      name: room.name,
      entry_fee: Number(room.entryFee),
      min_players: room.minPlayers,
      max_players: room.maxPlayers,
      current_players: room.currentPlayers,
      countdown_time: room.countdownTime,
      winning_percentage: room.winningPercentage,
      total_pot: 0,
      expected_payout: 0,
      commission: 0,
      status: room.status,
      created_at: room.createdAt,
    });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PUT /api/game-rooms/:id — update a room
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, entry_fee, min_players, max_players, countdown_time, winning_percentage, status } = req.body;

    // Check if room exists
    const [existing] = await db.select().from(gameRooms).where(eq(gameRooms.id, parseInt(id)));
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Build update object
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (entry_fee !== undefined) updates.entryFee = String(parseFloat(entry_fee));
    if (min_players !== undefined) updates.minPlayers = parseInt(min_players);
    if (max_players !== undefined) updates.maxPlayers = parseInt(max_players);
    if (countdown_time !== undefined) updates.countdownTime = parseInt(countdown_time);
    if (winning_percentage !== undefined) updates.winningPercentage = parseInt(winning_percentage);
    if (status !== undefined) updates.status = status;

    const [room] = await db.update(gameRooms)
      .set(updates)
      .where(eq(gameRooms.id, parseInt(id)))
      .returning();

    res.json({
      id: room.id,
      name: room.name,
      entry_fee: Number(room.entryFee),
      min_players: room.minPlayers,
      max_players: room.maxPlayers,
      current_players: room.currentPlayers,
      countdown_time: room.countdownTime,
      winning_percentage: room.winningPercentage,
      total_pot: Number(room.totalPot),
      expected_payout: Number(room.expectedPayout),
      commission: Number(room.commission),
      status: room.status,
      created_at: room.createdAt,
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// DELETE /api/game-rooms/:id — delete a room
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if room exists
    const [existing] = await db.select().from(gameRooms).where(eq(gameRooms.id, parseInt(id)));
    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Don't allow deleting active rooms
    if (existing.status === 'active' || existing.status === 'countdown') {
      return res.status(400).json({ error: 'Cannot delete an active or countdown room' });
    }

    await db.delete(gameRooms).where(eq(gameRooms.id, parseInt(id)));

    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ─── Win Percentage Rules Endpoints ──────────────────────────────────

// GET /api/game-rooms/:roomId/win-rules — get all rules for a room
router.get('/:roomId/win-rules', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Check if room exists
    const [room] = await db.select()
      .from(gameRooms)
      .where(eq(gameRooms.id, parseInt(roomId)));
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const rules = await db.select()
      .from(winPercentageRules)
      .where(eq(winPercentageRules.roomId, parseInt(roomId)))
      .orderBy(winPercentageRules.minPlayers);

    res.json(rules.map(r => ({
      id: r.id,
      room_id: r.roomId,
      min_players: r.minPlayers,
      max_players: r.maxPlayers,
      win_percentage: r.winPercentage,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    })));
  } catch (error) {
    logger.error('Fetch win rules error:', error);
    res.status(500).json({ error: 'Failed to fetch win rules' });
  }
});

// POST /api/game-rooms/:roomId/win-rules — create a new rule
router.post('/:roomId/win-rules', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { min_players, max_players, win_percentage, skip_validation } = req.body;

    // Check if room exists first
    const [room] = await db.select()
      .from(gameRooms)
      .where(eq(gameRooms.id, parseInt(roomId)));
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Validation
    if (!min_players || !max_players || !win_percentage) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const minP = parseInt(min_players);
    const maxP = parseInt(max_players);
    const winP = parseInt(win_percentage);

    if (minP < 1 || maxP < minP || winP < 1 || winP > 100) {
      return res.status(400).json({ error: 'Invalid values' });
    }

    // Get existing rules
    const existingRules = await db.select()
      .from(winPercentageRules)
      .where(eq(winPercentageRules.roomId, parseInt(roomId)));

    // Validate with new rule (skip if requested - used when creating multiple rules)
    if (!skip_validation) {
      const allRules = [
        ...existingRules.map(r => ({ min_players: r.minPlayers, max_players: r.maxPlayers })),
        { min_players: minP, max_players: maxP }
      ];

      // Don't require complete coverage - allow partial rules with smart fallback
      await validateRules(parseInt(roomId), allRules, false);
    }

    // Insert rule
    const [rule] = await db.insert(winPercentageRules).values({
      roomId: parseInt(roomId),
      minPlayers: minP,
      maxPlayers: maxP,
      winPercentage: winP,
    }).returning();

    // Log audit
    await db.insert(auditLogs).values({
      adminId: req.adminId || 'system',
      adminName: req.adminName || 'System',
      actionType: 'CREATE_WIN_RULE',
      details: `Created win rule for room ${roomId}: ${minP}-${maxP} players = ${winP}%`,
      ipAddress: req.adminIp || req.ip || '0.0.0.0',
    });

    logger.info(`Admin ${req.adminId} created win rule for room ${roomId}: ${minP}-${maxP} = ${winP}%`);

    res.json({
      id: rule.id,
      room_id: rule.roomId,
      min_players: rule.minPlayers,
      max_players: rule.maxPlayers,
      win_percentage: rule.winPercentage,
      created_at: rule.createdAt,
      updated_at: rule.updatedAt,
    });
  } catch (error) {
    logger.error('Create win rule error:', error);
    res.status(400).json({ error: error.message || 'Failed to create win rule' });
  }
});

// PUT /api/game-rooms/:roomId/win-rules/:ruleId — update a rule
router.put('/:roomId/win-rules/:ruleId', async (req, res) => {
  try {
    const { roomId, ruleId } = req.params;
    const { min_players, max_players, win_percentage } = req.body;

    const minP = parseInt(min_players);
    const maxP = parseInt(max_players);
    const winP = parseInt(win_percentage);

    if (minP < 1 || maxP < minP || winP < 1 || winP > 100) {
      return res.status(400).json({ error: 'Invalid values' });
    }

    // Check if rule exists first
    const [existingRule] = await db.select()
      .from(winPercentageRules)
      .where(eq(winPercentageRules.id, parseInt(ruleId)));

    if (!existingRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Verify rule belongs to the specified room
    if (existingRule.roomId !== parseInt(roomId)) {
      return res.status(403).json({ error: 'Rule does not belong to this room' });
    }

    // Get existing rules excluding this one
    const existingRules = await db.select()
      .from(winPercentageRules)
      .where(
        and(
          eq(winPercentageRules.roomId, parseInt(roomId)),
          sql`${winPercentageRules.id} != ${parseInt(ruleId)}`
        )
      );

    // Validate with updated rule
    const allRules = [
      ...existingRules.map(r => ({ min_players: r.minPlayers, max_players: r.maxPlayers })),
      { min_players: minP, max_players: maxP }
    ];

    // Don't require complete coverage - allow partial rules with smart fallback
    await validateRules(parseInt(roomId), allRules, false);

    // Update rule
    const [rule] = await db.update(winPercentageRules)
      .set({
        minPlayers: minP,
        maxPlayers: maxP,
        winPercentage: winP,
        updatedAt: new Date(),
      })
      .where(eq(winPercentageRules.id, parseInt(ruleId)))
      .returning();

    // Log audit
    await db.insert(auditLogs).values({
      adminId: req.adminId || 'system',
      adminName: req.adminName || 'System',
      actionType: 'UPDATE_WIN_RULE',
      details: `Updated win rule ${ruleId}: ${minP}-${maxP} players = ${winP}%`,
      ipAddress: req.adminIp || req.ip || '0.0.0.0',
    });

    logger.info(`Admin ${req.adminId} updated win rule ${ruleId}: ${minP}-${maxP} = ${winP}%`);

    res.json({
      id: rule.id,
      room_id: rule.roomId,
      min_players: rule.minPlayers,
      max_players: rule.maxPlayers,
      win_percentage: rule.winPercentage,
      created_at: rule.createdAt,
      updated_at: rule.updatedAt,
    });
  } catch (error) {
    logger.error('Update win rule error:', error);
    res.status(400).json({ error: error.message || 'Failed to update win rule' });
  }
});

// DELETE /api/game-rooms/:roomId/win-rules/:ruleId — delete a rule
router.delete('/:roomId/win-rules/:ruleId', async (req, res) => {
  try {
    const { roomId, ruleId } = req.params;

    // Check if rule exists
    const [existing] = await db.select()
      .from(winPercentageRules)
      .where(eq(winPercentageRules.id, parseInt(ruleId)));

    if (!existing) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Verify rule belongs to the specified room
    if (existing.roomId !== parseInt(roomId)) {
      return res.status(403).json({ error: 'Rule does not belong to this room' });
    }

    // Get remaining rules after deletion
    const remainingRules = await db.select()
      .from(winPercentageRules)
      .where(
        and(
          eq(winPercentageRules.roomId, parseInt(roomId)),
          sql`${winPercentageRules.id} != ${parseInt(ruleId)}`
        )
      );

    // Validate remaining rules only if there are any
    // Allow incomplete coverage - will use smart fallback (±5% adjustment)
    if (remainingRules.length > 0) {
      const rules = remainingRules.map(r => ({ min_players: r.minPlayers, max_players: r.maxPlayers }));
      try {
        // Don't require complete coverage - allow partial rules with smart fallback
        await validateRules(parseInt(roomId), rules, false);
      } catch (validationError) {
        return res.status(400).json({ 
          error: 'Cannot delete rule: ' + validationError.message,
          hint: 'Rules cannot overlap. Adjust other rules first or delete all rules.'
        });
      }
    } else {
      // Deleting the last rule - room will use smart fallback (±5% adjustment)
      logger.info(`Deleting last win rule for room ${roomId}, will use smart fallback`);
    }

    // Delete rule
    await db.delete(winPercentageRules).where(eq(winPercentageRules.id, parseInt(ruleId)));

    // Log audit
    await db.insert(auditLogs).values({
      adminId: req.adminId || 'system',
      adminName: req.adminName || 'System',
      actionType: 'DELETE_WIN_RULE',
      details: `Deleted win rule ${ruleId} from room ${roomId}`,
      ipAddress: req.adminIp || req.ip || '0.0.0.0',
    });

    logger.info(`Admin ${req.adminId} deleted win rule ${ruleId} from room ${roomId}`);

    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (error) {
    logger.error('Delete win rule error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete win rule' });
  }
});

// PATCH /api/game-rooms/:roomId/toggle-dynamic-percentage — toggle dynamic percentage
router.patch('/:roomId/toggle-dynamic-percentage', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { use_dynamic_percentage } = req.body;

    if (typeof use_dynamic_percentage !== 'boolean') {
      return res.status(400).json({ error: 'use_dynamic_percentage must be a boolean' });
    }

    // Check if room exists first
    const [existingRoom] = await db.select()
      .from(gameRooms)
      .where(eq(gameRooms.id, parseInt(roomId)));

    if (!existingRoom) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const [room] = await db.update(gameRooms)
      .set({ useDynamicPercentage: use_dynamic_percentage })
      .where(eq(gameRooms.id, parseInt(roomId)))
      .returning();

    // Log audit
    await db.insert(auditLogs).values({
      adminId: req.adminId || 'system',
      adminName: req.adminName || 'System',
      actionType: 'TOGGLE_DYNAMIC_PERCENTAGE',
      details: `${use_dynamic_percentage ? 'Enabled' : 'Disabled'} dynamic percentage for room ${roomId}`,
      ipAddress: req.adminIp || req.ip || '0.0.0.0',
    });

    logger.info(`Admin ${req.adminId} ${use_dynamic_percentage ? 'enabled' : 'disabled'} dynamic percentage for room ${roomId}`);

    res.json({
      id: room.id,
      use_dynamic_percentage: room.useDynamicPercentage,
    });
  } catch (error) {
    logger.error('Toggle dynamic percentage error:', error);
    res.status(500).json({ error: 'Failed to toggle dynamic percentage' });
  }
});

module.exports = router;
