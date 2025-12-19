import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all quick expenses for a specific week
router.get('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    const expenses = db.prepare('SELECT * FROM quick_expenses WHERE week_start = ? ORDER BY created_at DESC').all(weekStart);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a quick expense
router.post('/', (req, res) => {
  try {
    const { week_start, name, amount, note } = req.body;
    
    if (!week_start || !name || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO quick_expenses (week_start, name, amount, note)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(week_start, name, amount, note || null);
    
    const newExpense = db.prepare('SELECT * FROM quick_expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a quick expense
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM quick_expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Quick expense not found' });
    }
    
    db.prepare('DELETE FROM quick_expenses WHERE id = ?').run(id);
    
    res.json({ deleted: true, id: parseInt(id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

