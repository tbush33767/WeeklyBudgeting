import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get actual balance for a specific week
router.get('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    const balance = db.prepare('SELECT * FROM week_balances WHERE week_start = ?').get(weekStart);
    res.json(balance || { week_start: weekStart, actual_balance: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set or update actual balance for a specific week
router.put('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    const { actual_balance } = req.body;
    
    if (actual_balance === undefined) {
      return res.status(400).json({ error: 'Missing actual_balance' });
    }

    const stmt = db.prepare(`
      INSERT INTO week_balances (week_start, actual_balance, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(week_start) DO UPDATE SET 
        actual_balance = ?,
        updated_at = CURRENT_TIMESTAMP
    `);
    
    stmt.run(weekStart, actual_balance, actual_balance);
    
    res.json({ week_start: weekStart, actual_balance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear actual balance for a specific week
router.delete('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    
    db.prepare('DELETE FROM week_balances WHERE week_start = ?').run(weekStart);
    
    res.json({ week_start: weekStart, actual_balance: null, deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

