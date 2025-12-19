import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all paid expenses for a specific week (aggregated by expense_id)
router.get('/:weekStart', (req, res) => {
  try {
    const { weekStart } = req.params;
    // Return individual payment records
    const payments = db.prepare('SELECT * FROM paid_expenses WHERE week_start = ? ORDER BY paid_date').all(weekStart);
    
    // Also return aggregated totals per expense
    const totals = db.prepare(`
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
router.post('/', (req, res) => {
  try {
    const { expense_id, week_start, amount_paid } = req.body;
    
    if (!expense_id || !week_start || amount_paid === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const stmt = db.prepare(`
      INSERT INTO paid_expenses (expense_id, week_start, amount_paid)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(expense_id, week_start, amount_paid);
    
    // Get the total paid for this expense this week
    const totalPaid = db.prepare(`
      SELECT SUM(amount_paid) as total 
      FROM paid_expenses 
      WHERE expense_id = ? AND week_start = ?
    `).get(expense_id, week_start);
    
    res.status(201).json({ 
      id: result.lastInsertRowid,
      expense_id, 
      week_start, 
      amount_paid,
      total_paid: totalPaid.total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a specific payment by ID
router.delete('/payment/:paymentId', (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = db.prepare('SELECT * FROM paid_expenses WHERE id = ?').get(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    db.prepare('DELETE FROM paid_expenses WHERE id = ?').run(paymentId);
    
    res.json({ deleted: true, payment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all payments for an expense in a specific week
router.delete('/:expenseId/:weekStart', (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    db.prepare('DELETE FROM paid_expenses WHERE expense_id = ? AND week_start = ?').run(expenseId, weekStart);
    
    res.json({ expense_id: parseInt(expenseId), week_start: weekStart, cleared: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

