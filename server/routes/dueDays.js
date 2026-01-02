import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get due day override for a specific expense and week
router.get('/:expenseId/:weekStart', async (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    const override = await db.prepare(`
      SELECT * FROM weekly_due_days 
      WHERE expense_id = ? AND week_start = ?
    `).get(expenseId, weekStart);
    
    res.json(override || null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all due day overrides for a specific week
// This returns overrides where the due_date falls within the requested week,
// regardless of which week_start they were originally saved with
router.get('/week/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    
    // Calculate week end (6 days after week start)
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    // Get all overrides where the due_date falls within this week
    // This includes overrides that were saved for a different week_start
    // but have a due_date that falls within the requested week
    const overrides = await db.prepare(`
      SELECT * FROM weekly_due_days 
      WHERE due_date >= ? AND due_date <= ?
    `).all(weekStart, weekEnd);
    
    res.json(overrides);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or update due date override
router.put('/:expenseId/:weekStart', async (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    const { due_date } = req.body;
    
    if (!due_date) {
      return res.status(400).json({ error: 'due_date is required (format: YYYY-MM-DD)' });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(due_date)) {
      return res.status(400).json({ error: 'due_date must be in YYYY-MM-DD format' });
    }
    
    // Validate that the date is actually valid
    const dateObj = new Date(due_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date value' });
    }
    
    // Check if override already exists
    const existing = await db.prepare(`
      SELECT * FROM weekly_due_days 
      WHERE expense_id = ? AND week_start = ?
    `).get(expenseId, weekStart);
    
    if (existing) {
      // Update existing override
      try {
        const stmt = db.prepare(`
          UPDATE weekly_due_days 
          SET due_date = ? 
          WHERE expense_id = ? AND week_start = ?
          RETURNING *
        `);
        
        const result = await stmt.run(due_date, expenseId, weekStart);
        const updated = result.rows?.[0] || await db.prepare(`
          SELECT * FROM weekly_due_days 
          WHERE expense_id = ? AND week_start = ?
        `).get(expenseId, weekStart);
        
        res.json(updated);
      } catch (updateError) {
        console.error('Error updating due date override:', updateError);
        res.status(500).json({ error: `Failed to update: ${updateError.message}` });
      }
    } else {
      // Create new override
      try {
        const stmt = db.prepare(`
          INSERT INTO weekly_due_days (expense_id, week_start, due_date)
          VALUES (?, ?, ?)
          RETURNING *
        `);
        
        const result = await stmt.run(expenseId, weekStart, due_date);
        const newOverride = result.rows?.[0] || await db.prepare(`
          SELECT * FROM weekly_due_days WHERE id = ?
        `).get(result.lastInsertRowid);
        
        res.status(201).json(newOverride);
      } catch (insertError) {
        console.error('Error inserting due date override:', insertError);
        res.status(500).json({ error: `Failed to insert: ${insertError.message}` });
      }
    }
  } catch (error) {
    console.error('Error in PUT /due-days:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete due day override
router.delete('/:expenseId/:weekStart', async (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    const existing = await db.prepare(`
      SELECT * FROM weekly_due_days 
      WHERE expense_id = ? AND week_start = ?
    `).get(expenseId, weekStart);
    
    if (!existing) {
      return res.status(404).json({ error: 'Due day override not found' });
    }
    
    await db.prepare(`
      DELETE FROM weekly_due_days 
      WHERE expense_id = ? AND week_start = ?
    `).run(expenseId, weekStart);
    
    res.json({ deleted: true, expense_id: parseInt(expenseId), week_start: weekStart });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

