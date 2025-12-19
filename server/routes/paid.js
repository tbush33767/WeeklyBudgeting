import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all paid expenses for a specific week
router.get('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    const paid = db.prepare('SELECT * FROM paid_expenses WHERE week_start = ?').all(weekStart);
    res.json(paid);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark an expense as paid for a specific week
router.post('/', (req, res) => {
  try {
    const { expense_id, week_start } = req.body;
    
    if (!expense_id || !week_start) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO paid_expenses (expense_id, week_start)
      VALUES (?, ?)
    `);
    
    stmt.run(expense_id, week_start);
    
    res.status(201).json({ expense_id, week_start, paid: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unmark an expense as paid for a specific week
router.delete('/:expenseId/:weekStart', (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    db.prepare('DELETE FROM paid_expenses WHERE expense_id = ? AND week_start = ?').run(expenseId, weekStart);
    
    res.json({ expense_id: parseInt(expenseId), week_start: weekStart, paid: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

