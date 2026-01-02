import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Export all data to JSON
router.get('/export', async (req, res) => {
  try {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        expenses: await db.prepare('SELECT * FROM expenses').all(),
        income: await db.prepare('SELECT * FROM income').all(),
        paid_expenses: await db.prepare('SELECT * FROM paid_expenses').all(),
        week_rollovers: await db.prepare('SELECT * FROM week_rollovers').all(),
        weekly_income: await db.prepare('SELECT * FROM weekly_income').all(),
        weekly_expenses: await db.prepare('SELECT * FROM weekly_expenses').all(),
        quick_expenses: await db.prepare('SELECT * FROM quick_expenses').all(),
        week_balances: await db.prepare('SELECT * FROM week_balances').all(),
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="budget-backup-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(backup);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Import data from JSON
router.post('/import', async (req, res) => {
  try {
    const { data, clearExisting } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Use transaction method
    const counts = await db.transaction(async (tx) => {
      if (clearExisting) {
        // Clear existing data (in reverse order of dependencies)
        await tx.query('DELETE FROM paid_expenses');
        await tx.query('DELETE FROM weekly_income');
        await tx.query('DELETE FROM weekly_expenses');
        await tx.query('DELETE FROM quick_expenses');
        await tx.query('DELETE FROM week_balances');
        await tx.query('DELETE FROM week_rollovers');
        await tx.query('DELETE FROM income');
        await tx.query('DELETE FROM expenses');
      }

      let counts = {
        expenses: 0,
        income: 0,
        paid_expenses: 0,
        week_rollovers: 0,
        weekly_income: 0,
        weekly_expenses: 0,
        quick_expenses: 0,
        week_balances: 0,
      };

      // Import expenses (PostgreSQL uses ON CONFLICT instead of INSERT OR REPLACE)
      if (data.expenses?.length) {
        const stmt = tx.prepare(`
          INSERT INTO expenses (id, name, amount, category, frequency, due_day, start_date, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            amount = EXCLUDED.amount,
            category = EXCLUDED.category,
            frequency = EXCLUDED.frequency,
            due_day = EXCLUDED.due_day,
            start_date = EXCLUDED.start_date,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at
        `);
        for (const e of data.expenses) {
          await stmt.run(e.id, e.name, e.amount, e.category, e.frequency, e.due_day, e.start_date, e.is_active, e.created_at);
          counts.expenses++;
        }
      }

      // Import income
      if (data.income?.length) {
        const stmt = tx.prepare(`
          INSERT INTO income (id, name, amount, frequency, pay_day, start_date, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            amount = EXCLUDED.amount,
            frequency = EXCLUDED.frequency,
            pay_day = EXCLUDED.pay_day,
            start_date = EXCLUDED.start_date,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at
        `);
        for (const i of data.income) {
          await stmt.run(i.id, i.name, i.amount, i.frequency, i.pay_day, i.start_date, i.is_active, i.created_at);
          counts.income++;
        }
      }

      // Import paid_expenses
      if (data.paid_expenses?.length) {
        const stmt = tx.prepare(`
          INSERT INTO paid_expenses (id, expense_id, week_start, amount_paid, paid_date)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            expense_id = EXCLUDED.expense_id,
            week_start = EXCLUDED.week_start,
            amount_paid = EXCLUDED.amount_paid,
            paid_date = EXCLUDED.paid_date
        `);
        for (const p of data.paid_expenses) {
          await stmt.run(p.id, p.expense_id, p.week_start, p.amount_paid, p.paid_date);
          counts.paid_expenses++;
        }
      }

      // Import week_rollovers
      if (data.week_rollovers?.length) {
        const stmt = tx.prepare(`
          INSERT INTO week_rollovers (week_start, rollover_amount, created_at)
          VALUES (?, ?, ?)
          ON CONFLICT (week_start) DO UPDATE SET
            rollover_amount = EXCLUDED.rollover_amount,
            created_at = EXCLUDED.created_at
        `);
        for (const r of data.week_rollovers) {
          await stmt.run(r.week_start, r.rollover_amount, r.created_at);
          counts.week_rollovers++;
        }
      }

      // Import weekly_income
      if (data.weekly_income?.length) {
        const stmt = tx.prepare(`
          INSERT INTO weekly_income (id, income_id, week_start, actual_amount, received, received_date)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            income_id = EXCLUDED.income_id,
            week_start = EXCLUDED.week_start,
            actual_amount = EXCLUDED.actual_amount,
            received = EXCLUDED.received,
            received_date = EXCLUDED.received_date
        `);
        for (const w of data.weekly_income) {
          await stmt.run(w.id, w.income_id, w.week_start, w.actual_amount, w.received, w.received_date);
          counts.weekly_income++;
        }
      }

      // Import weekly_expenses
      if (data.weekly_expenses?.length) {
        const stmt = tx.prepare(`
          INSERT INTO weekly_expenses (id, expense_id, week_start, actual_amount, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            expense_id = EXCLUDED.expense_id,
            week_start = EXCLUDED.week_start,
            actual_amount = EXCLUDED.actual_amount,
            created_at = EXCLUDED.created_at
        `);
        for (const w of data.weekly_expenses) {
          await stmt.run(w.id, w.expense_id, w.week_start, w.actual_amount, w.created_at);
          counts.weekly_expenses++;
        }
      }

      // Import quick_expenses
      if (data.quick_expenses?.length) {
        const stmt = tx.prepare(`
          INSERT INTO quick_expenses (id, week_start, name, amount, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            week_start = EXCLUDED.week_start,
            name = EXCLUDED.name,
            amount = EXCLUDED.amount,
            note = EXCLUDED.note,
            created_at = EXCLUDED.created_at
        `);
        for (const q of data.quick_expenses) {
          await stmt.run(q.id, q.week_start, q.name, q.amount, q.note, q.created_at);
          counts.quick_expenses++;
        }
      }

      // Import week_balances
      if (data.week_balances?.length) {
        const stmt = tx.prepare(`
          INSERT INTO week_balances (week_start, actual_balance, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT (week_start) DO UPDATE SET
            actual_balance = EXCLUDED.actual_balance,
            updated_at = EXCLUDED.updated_at
        `);
        for (const b of data.week_balances) {
          await stmt.run(b.week_start, b.actual_balance, b.updated_at);
          counts.week_balances++;
        }
      }

      return counts;
    });
    
    res.json({ 
      success: true, 
      message: 'Data imported successfully',
      counts 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

