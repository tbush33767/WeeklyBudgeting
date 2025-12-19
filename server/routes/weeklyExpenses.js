import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all weekly expense overrides for a specific week
router.get('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    const expenseOverrides = db.prepare('SELECT * FROM weekly_expenses WHERE week_start = ?').all(weekStart);
    res.json(expenseOverrides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set or update actual expense amount for a specific week
router.put('/:expenseId/:weekStart', (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    const { actual_amount } = req.body;
    
    if (actual_amount === undefined) {
      return res.status(400).json({ error: 'Missing actual_amount' });
    }

    const stmt = db.prepare(`
      INSERT INTO weekly_expenses (expense_id, week_start, actual_amount)
      VALUES (?, ?, ?)
      ON CONFLICT(expense_id, week_start) DO UPDATE SET 
        actual_amount = ?
    `);
    
    stmt.run(expenseId, weekStart, actual_amount, actual_amount);
    
    res.json({ expense_id: parseInt(expenseId), week_start: weekStart, actual_amount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete expense override for a specific week (reset to default)
router.delete('/:expenseId/:weekStart', (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    db.prepare('DELETE FROM weekly_expenses WHERE expense_id = ? AND week_start = ?').run(expenseId, weekStart);
    
    res.json({ expense_id: parseInt(expenseId), week_start: weekStart, deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

