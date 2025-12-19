import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Helper to get the effective due day for a given month
// If due_day is 31 but month only has 30 days, returns 30
const getEffectiveDueDay = (dueDay, date) => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(dueDay, lastDay);
};

// Get all expenses
router.get('/', (req, res) => {
  try {
    const expenses = db.prepare('SELECT * FROM expenses ORDER BY category, name').all();
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get expenses for a specific week (based on date parameter)
router.get('/weekly/:date', (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);
    
    // Get the start of the week (Sunday) and end of week (Saturday)
    const dayOfWeek = targetDate.getDay();
    const startOfWeek = new Date(targetDate);
    startOfWeek.setDate(targetDate.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Get all active expenses
    const allExpenses = db.prepare('SELECT * FROM expenses WHERE is_active = 1').all();
    
    // Filter expenses that fall within this week
    const weeklyExpenses = allExpenses.filter(expense => {
      if (expense.frequency === 'one-time') {
        // One-time expenses: check if due_day matches any day in this week
        const dueDay = expense.due_day;
        for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
          const effectiveDueDay = getEffectiveDueDay(dueDay, d);
          if (d.getDate() === effectiveDueDay) return true;
        }
        return false;
      } else if (expense.frequency === 'weekly') {
        // Weekly expenses always apply
        return true;
      } else if (expense.frequency === 'biweekly') {
        // Biweekly: simplified - assume it applies every other week
        // In production, you'd track the actual pay schedule
        const weekNumber = Math.floor((targetDate.getTime() - new Date(targetDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
        return weekNumber % 2 === 0;
      } else if (expense.frequency === 'monthly') {
        // Monthly: check if the due_day falls within this week
        // Handle months with fewer days (e.g., due_day 31 in Feb becomes 28/29)
        const dueDay = expense.due_day;
        for (let d = new Date(startOfWeek); d <= endOfWeek; d.setDate(d.getDate() + 1)) {
          const effectiveDueDay = getEffectiveDueDay(dueDay, d);
          if (d.getDate() === effectiveDueDay) return true;
        }
        return false;
      }
      return false;
    });

    res.json({
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString(),
      expenses: weeklyExpenses
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new expense
router.post('/', (req, res) => {
  try {
    const { name, amount, category, frequency, due_day, start_date } = req.body;
    
    if (!name || amount === undefined || !category || !frequency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO expenses (name, amount, category, frequency, due_day, start_date, is_active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    
    const result = stmt.run(name, amount, category, frequency, due_day || null, start_date || null);
    
    const newExpense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an expense
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, category, frequency, due_day, start_date, is_active } = req.body;

    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    const stmt = db.prepare(`
      UPDATE expenses 
      SET name = ?, amount = ?, category = ?, frequency = ?, due_day = ?, start_date = ?, is_active = ?
      WHERE id = ?
    `);
    
    stmt.run(
      name ?? existing.name,
      amount ?? existing.amount,
      category ?? existing.category,
      frequency ?? existing.frequency,
      due_day ?? existing.due_day,
      start_date !== undefined ? start_date : existing.start_date,
      is_active ?? existing.is_active,
      id
    );

    const updated = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an expense
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    res.json({ message: 'Expense deleted', id: parseInt(id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

