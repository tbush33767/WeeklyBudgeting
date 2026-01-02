import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get all quick expenses for a specific week
router.get('/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    const expenses = await db.prepare('SELECT * FROM quick_expenses WHERE week_start = ? ORDER BY created_at DESC').all(weekStart);
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a quick expense
router.post('/', async (req, res) => {
  try {
    const { week_start, name, amount, note } = req.body;
    
    if (!week_start || !name || amount === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert into quick_expenses table
    const stmt = db.prepare(`
      INSERT INTO quick_expenses (week_start, name, amount, note)
      VALUES (?, ?, ?, ?)
      RETURNING *
    `);
    
    const result = await stmt.run(week_start, name, amount, note || null);
    const newExpense = result.rows?.[0] || await db.prepare('SELECT * FROM quick_expenses WHERE id = ?').get(result.lastInsertRowid);
    
    // Also add to weekly_expense_schedule table
    // Use the week_start as the due_date for quick expenses (they're due on the day they're added)
    const scheduleStmt = db.prepare(`
      INSERT INTO weekly_expense_schedule (
        expense_id, expense_name, week_start, due_date, amount, 
        is_quick_expense, quick_expense_id, note
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
      RETURNING *
    `);
    
    try {
      await scheduleStmt.run(
        null,  // expense_id is NULL for quick expenses
        name,
        week_start,
        week_start,  // Use week_start as due_date for quick expenses
        amount,
        newExpense.id,
        note || null
      );
    } catch (scheduleError) {
      // Log but don't fail - quick expense was created successfully
      console.error('Failed to add quick expense to schedule:', scheduleError);
    }
    
    res.status(201).json(newExpense);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a quick expense
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = await db.prepare('SELECT * FROM quick_expenses WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Quick expense not found' });
    }
    
    // Delete from schedule table first (foreign key constraint)
    // Use a more permissive delete that won't fail if entry doesn't exist
    try {
      const scheduleDelete = await db.prepare(`
        DELETE FROM weekly_expense_schedule 
        WHERE quick_expense_id = ?
      `).run(id);
      console.log(`Deleted ${scheduleDelete.changes || 0} schedule entries for quick expense ${id}`);
    } catch (scheduleError) {
      // Log but continue - the schedule entry might not exist
      console.log(`Note: Could not delete schedule entry for quick expense ${id}:`, scheduleError.message);
    }
    
    // Then delete from quick_expenses table
    try {
      const deleteResult = await db.prepare('DELETE FROM quick_expenses WHERE id = ?').run(id);
      
      // Check if any rows were deleted
      const rowsDeleted = deleteResult.changes || deleteResult.rowCount || 0;
      
      if (rowsDeleted === 0) {
        return res.status(404).json({ error: 'Quick expense not found or already deleted' });
      }
      
      res.json({ deleted: true, id: parseInt(id) });
    } catch (deleteError) {
      console.error('Error deleting quick expense:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    console.error('Error deleting quick expense:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

