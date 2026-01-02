import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all income sources
router.get('/', async (req, res) => {
  try {
    const income = await db.prepare('SELECT * FROM income ORDER BY name').all();
    res.json(income);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get total weekly income (calculated)
router.get('/weekly-total', async (req, res) => {
  try {
    const incomes = await db.prepare('SELECT * FROM income WHERE is_active = 1').all();
    
    // Calculate weekly equivalent for each income
    let weeklyTotal = 0;
    incomes.forEach(income => {
      if (income.frequency === 'weekly') {
        weeklyTotal += income.amount;
      } else if (income.frequency === 'biweekly') {
        weeklyTotal += income.amount / 2;
      } else if (income.frequency === 'monthly') {
        weeklyTotal += (income.amount * 12) / 52;
      }
    });

    res.json({ weeklyTotal: Math.round(weeklyTotal * 100) / 100 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new income source
router.post('/', async (req, res) => {
  try {
    const { name, amount, frequency, pay_day, start_date } = req.body;
    
    if (!name || amount === undefined || !frequency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO income (name, amount, frequency, pay_day, start_date, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
      RETURNING *
    `);
    
    const result = await stmt.run(name, amount, frequency, pay_day ?? 5, start_date || null);
    const newIncome = result.rows?.[0] || await db.prepare('SELECT * FROM income WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newIncome);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update an income source
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, frequency, pay_day, start_date, is_active } = req.body;

    const existing = await db.prepare('SELECT * FROM income WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Income source not found' });
    }

    const stmt = db.prepare(`
      UPDATE income 
      SET name = ?, amount = ?, frequency = ?, pay_day = ?, start_date = ?, is_active = ?
      WHERE id = ?
      RETURNING *
    `);
    
    const result = await stmt.run(
      name ?? existing.name,
      amount ?? existing.amount,
      frequency ?? existing.frequency,
      pay_day ?? existing.pay_day,
      start_date !== undefined ? start_date : existing.start_date,
      is_active ?? existing.is_active,
      id
    );

    const updated = result.rows?.[0] || await db.prepare('SELECT * FROM income WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an income source
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.prepare('SELECT * FROM income WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Income source not found' });
    }

    await db.prepare('DELETE FROM income WHERE id = ?').run(id);
    res.json({ message: 'Income source deleted', id: parseInt(id) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

