import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Helper to get effective due day for a month
const getEffectiveDueDay = (dueDay, date) => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return Math.min(dueDay, lastDay);
};

// Helper to check if biweekly item applies to a given week
const isBiweeklyWeek = (startDate, weekStartDate) => {
  if (!startDate) {
    const weekStart = new Date(weekStartDate);
    const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
    const weekNum = Math.floor((weekStart.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekNum % 2 === 0;
  }
  const start = new Date(startDate);
  const weekStart = new Date(weekStartDate);
  const diffTime = weekStart.getTime() - start.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks % 2 === 0;
};

// ===== EXPENSE SCHEDULE =====

// Get all expenses for a week (scheduled + calculated)
// This is the main endpoint that returns what should appear in a week
// It also auto-populates the schedule table with calculated expenses
router.get('/expenses/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    
    // Calculate week end (6 days after week start)
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    // Get all scheduled expenses where due_date falls within this week
    const scheduled = await db.prepare(`
      SELECT * FROM weekly_expense_schedule 
      WHERE due_date >= ? AND due_date <= ?
    `).all(weekStart, weekEnd);
    
    // Get all active expenses
    const allExpenses = await db.prepare(`
      SELECT * FROM expenses WHERE is_active = 1
    `).all();
    
    // Create a map of scheduled expense IDs for this week
    const scheduledExpenseIds = new Set();
    const scheduledByExpenseId = {};
    scheduled.forEach(s => {
      scheduledExpenseIds.add(s.expense_id);
      scheduledByExpenseId[s.expense_id] = s;
    });
    
    // Calculate which expenses should appear this week based on frequency/due_day
    // and auto-populate the schedule table
    const calculatedExpenses = [];
    const insertStmt = db.prepare(`
      INSERT INTO weekly_expense_schedule (expense_id, expense_name, week_start, due_date, amount, is_quick_expense)
      VALUES (?, ?, ?, ?, ?, 0)
      ON CONFLICT (expense_id, week_start) DO NOTHING
    `);
    
    for (const expense of allExpenses) {
      let shouldAppear = false;
      let dueDate = null;
      
      if (expense.frequency === 'weekly') {
        // Weekly expenses appear every week
        shouldAppear = true;
        // Use week start as due date, or use due_day if specified
        if (expense.due_day) {
          const weekDate = new Date(weekStartDate);
          const year = weekDate.getFullYear();
          const month = weekDate.getMonth() + 1;
          const lastDay = new Date(year, month, 0).getDate();
          const day = Math.min(expense.due_day, lastDay);
          dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else {
          dueDate = weekStart;
        }
      } else if (expense.frequency === 'biweekly') {
        // Biweekly expenses appear every other week
        if (isBiweeklyWeek(expense.start_date, weekStart)) {
          shouldAppear = true;
          if (expense.due_day) {
            const weekDate = new Date(weekStartDate);
            const year = weekDate.getFullYear();
            const month = weekDate.getMonth() + 1;
            const lastDay = new Date(year, month, 0).getDate();
            const day = Math.min(expense.due_day, lastDay);
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else {
            dueDate = weekStart;
          }
        }
      } else if (expense.frequency === 'monthly' && expense.due_day) {
        // Monthly expenses: check if due_day falls within this week
        for (let d = new Date(weekStartDate); d <= weekEndDate; d.setDate(d.getDate() + 1)) {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, d);
          if (d.getDate() === effectiveDueDay) {
            shouldAppear = true;
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            break;
          }
        }
      } else if (expense.frequency === 'one-time' && expense.due_day) {
        // One-time expenses: check if due_day matches any day in this week
        for (let d = new Date(weekStartDate); d <= weekEndDate; d.setDate(d.getDate() + 1)) {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, d);
          if (d.getDate() === effectiveDueDay) {
            shouldAppear = true;
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            break;
          }
        }
      }
      
      if (shouldAppear && dueDate) {
        // Check if already scheduled (explicit override exists)
        if (scheduledExpenseIds.has(expense.id)) {
          // Use the scheduled entry (may have different amount or due_date)
          const scheduledEntry = scheduledByExpenseId[expense.id];
          calculatedExpenses.push({
            ...scheduledEntry,
            is_calculated: false
          });
        } else {
          // Auto-populate the schedule table with calculated expense
          try {
            await insertStmt.run(expense.id, expense.name, weekStart, dueDate, expense.amount);
          } catch (err) {
            // Ignore errors (might be duplicate key, etc.)
            console.log(`Note: Could not auto-insert schedule for expense ${expense.id}:`, err.message);
          }
          
          calculatedExpenses.push({
            expense_id: expense.id,
            week_start: weekStart,
            due_date: dueDate,
            amount: expense.amount,
            is_calculated: true
          });
        }
      }
    }
    
    // Re-fetch all scheduled expenses for this week (now includes auto-populated ones and quick expenses)
    const allScheduled = await db.prepare(`
      SELECT * FROM weekly_expense_schedule 
      WHERE due_date >= ? AND due_date <= ?
      ORDER BY due_date ASC, created_at ASC
    `).all(weekStart, weekEnd);
    
    // Mark which ones were explicitly scheduled vs auto-calculated
    // Quick expenses (is_quick_expense = 1) are never considered "calculated"
    const result = allScheduled.map(s => {
      if (s.is_quick_expense === 1) {
        return {
          ...s,
          is_calculated: false  // Quick expenses are always explicit
        };
      }
      const wasExplicit = scheduledExpenseIds.has(s.expense_id);
      return {
        ...s,
        is_calculated: !wasExplicit
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error fetching expense schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add or update an expense in the schedule for a specific week
router.put('/expenses/:expenseId/:weekStart', async (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    const { due_date, amount } = req.body;
    
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
    
    // Get the expense to use default amount if not provided
    const expense = await db.prepare('SELECT * FROM expenses WHERE id = ?').get(expenseId);
    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }
    
    const expenseAmount = amount !== undefined ? amount : expense.amount;
    
    // Calculate the week_start for the new due_date
    const newDueDate = new Date(due_date);
    const newWeekStart = new Date(newDueDate);
    // Find Friday of the week (week starts on Friday)
    const dayOfWeek = newWeekStart.getDay();
    const daysToFriday = dayOfWeek === 5 ? 0 : (dayOfWeek < 5 ? dayOfWeek + 2 : dayOfWeek - 5);
    newWeekStart.setDate(newWeekStart.getDate() - daysToFriday);
    const newWeekStartStr = newWeekStart.toISOString().split('T')[0];
    
    // Find all existing schedule entries for this expense
    const existingEntries = await db.prepare(`
      SELECT * FROM weekly_expense_schedule 
      WHERE expense_id = ?
    `).all(expenseId);
    
    // Remove old entries based on expense frequency
    // We need to delete old entries BEFORE checking if the new one exists
    if (expense.frequency === 'monthly') {
      // For monthly expenses, remove any entry in the same month/year
      // This ensures only one entry per month
      const dueDateMonth = newDueDate.getMonth();
      const dueDateYear = newDueDate.getFullYear();
      
      for (const entry of existingEntries) {
        const entryDate = new Date(entry.due_date);
        const entryMonth = entryDate.getMonth();
        const entryYear = entryDate.getFullYear();
        
        // If it's the same month/year, delete it (we'll add the new one below)
        if (entryMonth === dueDateMonth && entryYear === dueDateYear) {
          const deleteResult = await db.prepare(`
            DELETE FROM weekly_expense_schedule 
            WHERE expense_id = ? AND week_start = ?
          `).run(expenseId, entry.week_start);
          console.log(`Deleted monthly expense entry: expense_id=${expenseId}, week_start=${entry.week_start}, deleted=${deleteResult.changes}`);
        }
      }
    } else {
      // For non-monthly expenses, remove ALL existing entries for this expense
      // This ensures we don't have duplicates when moving expenses between weeks
      for (const entry of existingEntries) {
        // Delete all existing entries - we'll add the new one below
        const deleteResult = await db.prepare(`
          DELETE FROM weekly_expense_schedule 
          WHERE expense_id = ? AND week_start = ?
        `).run(expenseId, entry.week_start);
        console.log(`Deleted expense entry: expense_id=${expenseId}, week_start=${entry.week_start}, deleted=${deleteResult.changes}`);
      }
    }
    
    // Insert the schedule entry with the new week_start
    // Note: We've already deleted all old entries above, so we can just insert
    // Note: expense_id cannot be NULL for regular expenses, so we use the expenseId
    try {
      // Double-check: delete any entry that might exist in the new week_start (shouldn't happen, but be safe)
      await db.prepare(`
        DELETE FROM weekly_expense_schedule 
        WHERE expense_id = ? AND week_start = ?
      `).run(expenseId, newWeekStartStr);
      
      // Insert new entry (we've deleted all old ones, so this should always be an insert)
      const insertStmt = db.prepare(`
        INSERT INTO weekly_expense_schedule (expense_id, expense_name, week_start, due_date, amount, is_quick_expense)
        VALUES (?, ?, ?, ?, ?, 0)
        RETURNING *
      `);
      const insertResult = await insertStmt.run(expenseId, expense.name, newWeekStartStr, due_date, expenseAmount);
      let scheduled = insertResult.rows?.[0];
      
      // If RETURNING didn't work, fetch it
      if (!scheduled) {
        scheduled = await db.prepare(`
          SELECT * FROM weekly_expense_schedule 
          WHERE expense_id = ? AND week_start = ?
        `).get(expenseId, newWeekStartStr);
      }
      
      if (!scheduled) {
        throw new Error('Failed to retrieve scheduled expense after insert/update');
      }
      
      res.json(scheduled);
    } catch (dbError) {
      console.error('Database error updating expense schedule:', dbError);
      console.error('Error details:', {
        message: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        hint: dbError.hint
      });
      console.error('Query parameters:', { expenseId, expenseName: expense.name, newWeekStartStr, due_date, expenseAmount });
      throw dbError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Error updating expense schedule:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: error.message || 'Failed to update expense schedule' });
  }
});

// Remove an expense from the schedule for a specific week
router.delete('/expenses/:expenseId/:weekStart', async (req, res) => {
  try {
    const { expenseId, weekStart } = req.params;
    
    const existing = await db.prepare(`
      SELECT * FROM weekly_expense_schedule 
      WHERE expense_id = ? AND week_start = ?
    `).get(expenseId, weekStart);
    
    if (!existing) {
      return res.status(404).json({ error: 'Scheduled expense not found' });
    }
    
    await db.prepare(`
      DELETE FROM weekly_expense_schedule 
      WHERE expense_id = ? AND week_start = ?
    `).run(expenseId, weekStart);
    
    res.json({ deleted: true, expense_id: parseInt(expenseId), week_start: weekStart });
  } catch (error) {
    console.error('Error deleting expense schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== INCOME SCHEDULE =====

// Get all scheduled income for a specific week
router.get('/income/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    
    // Calculate week end (6 days after week start)
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    // Get all scheduled income where pay_date falls within this week
    const scheduled = await db.prepare(`
      SELECT * FROM weekly_income_schedule 
      WHERE pay_date >= ? AND pay_date <= ?
      ORDER BY pay_date ASC
    `).all(weekStart, weekEnd);
    
    res.json(scheduled);
  } catch (error) {
    console.error('Error fetching income schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add or update income in the schedule for a specific week
router.put('/income/:incomeId/:weekStart', async (req, res) => {
  try {
    const { incomeId, weekStart } = req.params;
    const { pay_date, amount } = req.body;
    
    if (!pay_date) {
      return res.status(400).json({ error: 'pay_date is required (format: YYYY-MM-DD)' });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(pay_date)) {
      return res.status(400).json({ error: 'pay_date must be in YYYY-MM-DD format' });
    }
    
    // Validate that the date is actually valid
    const dateObj = new Date(pay_date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ error: 'Invalid date value' });
    }
    
    // Get the income to use default amount if not provided
    const income = await db.prepare('SELECT * FROM income WHERE id = ?').get(incomeId);
    if (!income) {
      return res.status(404).json({ error: 'Income not found' });
    }
    
    const incomeAmount = amount !== undefined ? amount : income.amount;
    
    // Insert or update the schedule entry
    const stmt = db.prepare(`
      INSERT INTO weekly_income_schedule (income_id, week_start, pay_date, amount)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (income_id, week_start) DO UPDATE SET
        pay_date = EXCLUDED.pay_date,
        amount = EXCLUDED.amount
      RETURNING *
    `);
    
    const result = await stmt.run(incomeId, weekStart, pay_date, incomeAmount);
    const scheduled = result.rows?.[0] || await db.prepare(`
      SELECT * FROM weekly_income_schedule 
      WHERE income_id = ? AND week_start = ?
    `).get(incomeId, weekStart);
    
    res.json(scheduled);
  } catch (error) {
    console.error('Error updating income schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove income from the schedule for a specific week
router.delete('/income/:incomeId/:weekStart', async (req, res) => {
  try {
    const { incomeId, weekStart } = req.params;
    
    const existing = await db.prepare(`
      SELECT * FROM weekly_income_schedule 
      WHERE income_id = ? AND week_start = ?
    `).get(incomeId, weekStart);
    
    if (!existing) {
      return res.status(404).json({ error: 'Scheduled income not found' });
    }
    
    await db.prepare(`
      DELETE FROM weekly_income_schedule 
      WHERE income_id = ? AND week_start = ?
    `).run(incomeId, weekStart);
    
    res.json({ deleted: true, income_id: parseInt(incomeId), week_start: weekStart });
  } catch (error) {
    console.error('Error deleting income schedule:', error);
    res.status(500).json({ error: error.message });
  }
});

// Crosscheck endpoint to verify schedule matches what should be displayed
router.get('/crosscheck/:weekStart', async (req, res) => {
  try {
    const { weekStart } = req.params;
    
    // Calculate week end (6 days after week start)
    const weekStartDate = new Date(weekStart);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekEndDate.getDate() + 6);
    const weekEnd = weekEndDate.toISOString().split('T')[0];
    
    // Get what's actually in the schedule table for this week
    const scheduleEntries = await db.prepare(`
      SELECT * FROM weekly_expense_schedule 
      WHERE due_date >= ? AND due_date <= ?
      ORDER BY expense_id, due_date
    `).all(weekStart, weekEnd);
    
    // Get all active expenses
    const allExpenses = await db.prepare(`
      SELECT * FROM expenses WHERE is_active = 1
    `).all();
    
    // Calculate what SHOULD be in the schedule based on frequency/due_day
    const expectedEntries = [];
    const scheduledExpenseIds = new Set(scheduleEntries.map(s => s.expense_id));
    
    for (const expense of allExpenses) {
      let shouldAppear = false;
      let dueDate = null;
      
      if (expense.frequency === 'weekly') {
        shouldAppear = true;
        if (expense.due_day) {
          const weekDate = new Date(weekStartDate);
          const year = weekDate.getFullYear();
          const month = weekDate.getMonth() + 1;
          const lastDay = new Date(year, month, 0).getDate();
          const day = Math.min(expense.due_day, lastDay);
          dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else {
          dueDate = weekStart;
        }
      } else if (expense.frequency === 'biweekly') {
        if (isBiweeklyWeek(expense.start_date, weekStart)) {
          shouldAppear = true;
          if (expense.due_day) {
            const weekDate = new Date(weekStartDate);
            const year = weekDate.getFullYear();
            const month = weekDate.getMonth() + 1;
            const lastDay = new Date(year, month, 0).getDate();
            const day = Math.min(expense.due_day, lastDay);
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          } else {
            dueDate = weekStart;
          }
        }
      } else if (expense.frequency === 'monthly' && expense.due_day) {
        for (let d = new Date(weekStartDate); d <= weekEndDate; d.setDate(d.getDate() + 1)) {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, d);
          if (d.getDate() === effectiveDueDay) {
            shouldAppear = true;
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            break;
          }
        }
      } else if (expense.frequency === 'one-time' && expense.due_day) {
        for (let d = new Date(weekStartDate); d <= weekEndDate; d.setDate(d.getDate() + 1)) {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, d);
          if (d.getDate() === effectiveDueDay) {
            shouldAppear = true;
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const day = d.getDate();
            dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            break;
          }
        }
      }
      
      if (shouldAppear && dueDate) {
        expectedEntries.push({
          expense_id: expense.id,
          expense_name: expense.name,
          due_date: dueDate,
          amount: expense.amount,
          frequency: expense.frequency
        });
      }
    }
    
    // Compare schedule vs expected
    const scheduleMap = new Map();
    scheduleEntries.forEach(entry => {
      const key = `${entry.expense_id}-${entry.due_date}`;
      scheduleMap.set(key, entry);
    });
    
    const expectedMap = new Map();
    expectedEntries.forEach(entry => {
      const key = `${entry.expense_id}-${entry.due_date}`;
      expectedMap.set(key, entry);
    });
    
    // Find discrepancies
    const missingInSchedule = expectedEntries.filter(exp => {
      const key = `${exp.expense_id}-${exp.due_date}`;
      return !scheduleMap.has(key);
    });
    
    const extraInSchedule = scheduleEntries.filter(entry => {
      const key = `${entry.expense_id}-${entry.due_date}`;
      return !expectedMap.has(key);
    });
    
    const mismatched = scheduleEntries.filter(entry => {
      const key = `${entry.expense_id}-${entry.due_date}`;
      const expected = expectedMap.get(key);
      if (!expected) return false;
      
      // Check if amount or due_date differs (due_date difference might be intentional override)
      return entry.amount !== expected.amount;
    });
    
    res.json({
      weekStart,
      weekEnd,
      summary: {
        inSchedule: scheduleEntries.length,
        expected: expectedEntries.length,
        missingInSchedule: missingInSchedule.length,
        extraInSchedule: extraInSchedule.length,
        mismatched: mismatched.length
      },
      details: {
        scheduleEntries: scheduleEntries.map(e => ({
          expense_id: e.expense_id,
          expense_name: e.expense_name,
          week_start: e.week_start,
          due_date: e.due_date,
          amount: e.amount
        })),
        expectedEntries: expectedEntries.map(e => ({
          expense_id: e.expense_id,
          expense_name: e.expense_name,
          due_date: e.due_date,
          amount: e.amount,
          frequency: e.frequency
        })),
        missingInSchedule: missingInSchedule.map(e => ({
          expense_id: e.expense_id,
          expense_name: e.expense_name,
          due_date: e.due_date,
          amount: e.amount,
          frequency: e.frequency,
          reason: 'Should be in schedule but is missing'
        })),
        extraInSchedule: extraInSchedule.map(e => ({
          expense_id: e.expense_id,
          expense_name: e.expense_name,
          week_start: e.week_start,
          due_date: e.due_date,
          amount: e.amount,
          reason: 'In schedule but not expected (may be manual override)'
        })),
        mismatched: mismatched.map(e => {
          const key = `${e.expense_id}-${e.due_date}`;
          const expected = expectedMap.get(key);
          return {
            expense_id: e.expense_id,
            expense_name: e.expense_name,
            due_date: e.due_date,
            scheduleAmount: e.amount,
            expectedAmount: expected.amount,
            reason: 'Amount differs from expected'
          };
        })
      }
    });
  } catch (error) {
    console.error('Error in crosscheck:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
