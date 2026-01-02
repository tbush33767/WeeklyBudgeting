import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all paid expenses for a specific week (aggregated by expense_id)
router.get('/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    // Return individual payment records
    const payments = await db.prepare('SELECT * FROM paid_expenses WHERE week_start = ? ORDER BY paid_date').all(weekStart);
    
    // Also return aggregated totals per expense
    const totals = await db.prepare(`
      SELECT expense_id, SUM(amount_paid) as total_paid 
      FROM paid_expenses 
      WHERE week_start = ? 
      GROUP BY expense_id
    `).all(weekStart);
    
    res.json({ payments, totals });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a payment for an expense (supports partial payments)
router.post('/', async (req, res) => {
  try {
    const { expense_id, week_start, amount_paid } = req.body;
    
    if (!expense_id || !week_start || amount_paid === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO paid_expenses (expense_id, week_start, amount_paid)
      VALUES (?, ?, ?)
      RETURNING *
    `);
    
    const result = await stmt.run(expense_id, week_start, amount_paid);
    const newPayment = result.rows?.[0] || await db.prepare('SELECT * FROM paid_expenses WHERE id = ?').get(result.lastInsertRowid);
    
    // Get the total paid for this expense this week
    const totalPaid = await db.prepare(`
      SELECT SUM(amount_paid) as total 
      FROM paid_expenses 
      WHERE expense_id = ? AND week_start = ?
    `).get(expense_id, week_start);
    
    res.status(201).json({ 
      ...newPayment,
      total_paid: totalPaid?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific payment by ID
router.delete('/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await db.prepare('SELECT * FROM paid_expenses WHERE id = ?').get(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    await db.prepare('DELETE FROM paid_expenses WHERE id = ?').run(paymentId);
    
    res.json({ deleted: true, payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all payments for an expense in a specific week
router.delete('/:expenseId/:weekStart', async (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    await db.prepare('DELETE FROM paid_expenses WHERE expense_id = ? AND week_start = ?').run(expenseId, weekStart);
    
    res.json({ expense_id: parseInt(expenseId), week_start: weekStart, cleared: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a payment's paid_date
router.put('/payment/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { paid_date } = req.body;
    
    if (!paid_date) {
      return res.status(400).json({ error: 'paid_date is required' });
    }
    
    const payment = await db.prepare('SELECT * FROM paid_expenses WHERE id = ?').get(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const stmt = db.prepare('UPDATE paid_expenses SET paid_date = ? WHERE id = ? RETURNING *');
    const result = await stmt.run(paid_date, paymentId);
    const updated = result.rows?.[0] || await db.prepare('SELECT * FROM paid_expenses WHERE id = ?').get(paymentId);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

