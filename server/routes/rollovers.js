import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get rollover for a specific week
router.get('/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    const rollover = await db.prepare('SELECT * FROM week_rollovers WHERE week_start = ?').get(weekStart);
    res.json(rollover || { week_start: weekStart, rollover_amount: 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set or update rollover for a specific week
router.put('/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    const { rollover_amount } = req.body;
    
    if (rollover_amount === undefined) {
      return res.status(400).json({ error: 'Missing rollover_amount' });
    }

    const stmt = db.prepare(`
      INSERT INTO week_rollovers (week_start, rollover_amount)
      VALUES (?, ?)
      ON CONFLICT(week_start) DO UPDATE SET rollover_amount = ?
      RETURNING *
    `);
    
    const result = await stmt.run(weekStart, rollover_amount, rollover_amount);
    const updated = result.rows?.[0] || { week_start: weekStart, rollover_amount };
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete rollover for a specific week (reset to 0)
router.delete('/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    
    await db.prepare('DELETE FROM week_rollovers WHERE week_start = ?').run(weekStart);
    
    res.json({ week_start: weekStart, rollover_amount: 0, deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

