import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all weekly income overrides for a specific week
router.get('/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    const incomeOverrides = await db.prepare('SELECT * FROM weekly_income WHERE week_start = ?').all(weekStart);
    res.json(incomeOverrides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set or update actual income for a specific week
router.put('/:incomeId/:weekStart', async (req, res) => {
  try {
    const { incomeId, weekStart } = req.params;
    const { actual_amount, received } = req.body;
    
    if (actual_amount === undefined) {
      return res.status(400).json({ error: 'Missing actual_amount' });
    }

    const stmt = db.prepare(`
      INSERT INTO weekly_income (income_id, week_start, actual_amount, received)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(income_id, week_start) DO UPDATE SET 
        actual_amount = ?,
        received = ?
      RETURNING *
    `);
    
    const receivedVal = received !== undefined ? (received ? 1 : 0) : 1;
    const result = await stmt.run(incomeId, weekStart, actual_amount, receivedVal, actual_amount, receivedVal);
    const updated = result.rows?.[0] || { income_id: parseInt(incomeId), week_start: weekStart, actual_amount, received: receivedVal };
    
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete income override for a specific week (reset to default)
router.delete('/:incomeId/:weekStart', async (req, res) => {
  try {
    const { incomeId, weekStart } = req.params;
    
    await db.prepare('DELETE FROM weekly_income WHERE income_id = ? AND week_start = ?').run(incomeId, weekStart);
    
    res.json({ income_id: parseInt(incomeId), week_start: weekStart, deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

