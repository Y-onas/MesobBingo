const { Router } = require('express');
const { eq, desc } = require('drizzle-orm');
const { db } = require('../../database');
const { gameRooms } = require('../../database/schema');

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

module.exports = router;
