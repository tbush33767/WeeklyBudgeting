-- PostgreSQL Schema for Weekly Budgeting App
-- Converted from SQLite schema

-- Expenses table for bills, living expenses, debts, and savings
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('bill', 'living', 'debt', 'savings')),
    frequency TEXT NOT NULL CHECK (frequency IN ('one-time', 'weekly', 'biweekly', 'monthly')),
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    start_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Income sources table
CREATE TABLE IF NOT EXISTS income (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    pay_day INTEGER NOT NULL DEFAULT 5 CHECK (pay_day >= 0 AND pay_day <= 6),
    start_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track paid expenses per week (supports partial payments)
CREATE TABLE IF NOT EXISTS paid_expenses (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    amount_paid REAL NOT NULL,
    paid_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

-- Legacy paycheck settings (kept for backwards compatibility)
CREATE TABLE IF NOT EXISTS paycheck (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    amount REAL NOT NULL DEFAULT 0,
    frequency TEXT NOT NULL DEFAULT 'biweekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    pay_day INTEGER NOT NULL DEFAULT 5 CHECK (pay_day >= 0 AND pay_day <= 6)
);

-- Insert default paycheck if not exists
INSERT INTO paycheck (id, amount, frequency, pay_day) 
VALUES (1, 0, 'biweekly', 5)
ON CONFLICT (id) DO NOTHING;

-- Week rollovers (money left over from previous week)
CREATE TABLE IF NOT EXISTS week_rollovers (
    week_start TEXT PRIMARY KEY,
    rollover_amount REAL NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track actual income received per week (allows overriding expected amount)
CREATE TABLE IF NOT EXISTS weekly_income (
    id SERIAL PRIMARY KEY,
    income_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    actual_amount REAL NOT NULL,
    received INTEGER DEFAULT 1,
    received_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(income_id, week_start),
    FOREIGN KEY (income_id) REFERENCES income(id) ON DELETE CASCADE
);

-- Quick expenses (one-off, non-budgeted expenses per week)
CREATE TABLE IF NOT EXISTS quick_expenses (
    id SERIAL PRIMARY KEY,
    week_start TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly actual balance tracking
CREATE TABLE IF NOT EXISTS week_balances (
    week_start TEXT PRIMARY KEY,
    actual_balance REAL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track expense amount overrides per week (allows modifying a single bill occurrence)
CREATE TABLE IF NOT EXISTS weekly_expenses (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    actual_amount REAL NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(expense_id, week_start),
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

-- NEW: Explicit schedule table for expenses
-- This table explicitly tracks which expenses appear in which week
-- When you modify a due date or add an expense to a week, it creates an entry here
-- Also includes quick expenses (one-off expenses) for a complete bank statement view
CREATE TABLE IF NOT EXISTS weekly_expense_schedule (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER,  -- NULL for quick expenses, otherwise references expenses(id)
    expense_name TEXT NOT NULL,  -- Denormalized expense name for easier troubleshooting
    week_start TEXT NOT NULL,
    due_date TEXT NOT NULL,  -- The actual date this expense is due in this week
    amount REAL NOT NULL,  -- Amount of the expense
    is_quick_expense INTEGER DEFAULT 0,  -- 1 if this is a quick expense, 0 if regular expense
    quick_expense_id INTEGER,  -- References quick_expenses(id) if is_quick_expense = 1
    note TEXT,  -- Optional note (mainly for quick expenses)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Note: Unique constraints are handled via indexes below
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
    FOREIGN KEY (quick_expense_id) REFERENCES quick_expenses(id) ON DELETE CASCADE
);

-- NEW: Explicit schedule table for income
-- This table explicitly tracks which income appears in which week
CREATE TABLE IF NOT EXISTS weekly_income_schedule (
    id SERIAL PRIMARY KEY,
    income_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    pay_date TEXT NOT NULL,  -- The actual date this income is received in this week
    amount REAL,  -- Optional: if different from income.amount, overrides it
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(income_id, week_start),
    FOREIGN KEY (income_id) REFERENCES income(id) ON DELETE CASCADE
);

-- Track due date overrides per week (DEPRECATED - use weekly_expense_schedule instead)
-- Keeping for backwards compatibility during migration
CREATE TABLE IF NOT EXISTS weekly_due_days (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    due_date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(expense_id, week_start),
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_expenses_is_active ON expenses(is_active);
CREATE INDEX IF NOT EXISTS idx_paid_expenses_week_start ON paid_expenses(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_income_week_start ON weekly_income(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_expenses_week_start ON weekly_expenses(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_due_days_week_start ON weekly_due_days(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_due_days_due_date ON weekly_due_days(due_date);
CREATE INDEX IF NOT EXISTS idx_weekly_expense_schedule_week_start ON weekly_expense_schedule(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_expense_schedule_due_date ON weekly_expense_schedule(due_date);
-- Partial unique indexes for regular expenses and quick expenses
CREATE UNIQUE INDEX IF NOT EXISTS weekly_expense_schedule_expense_week_unique 
  ON weekly_expense_schedule (expense_id, week_start) 
  WHERE expense_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS weekly_expense_schedule_quick_expense_unique 
  ON weekly_expense_schedule (quick_expense_id) 
  WHERE quick_expense_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_income_schedule_week_start ON weekly_income_schedule(week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_income_schedule_pay_date ON weekly_income_schedule(pay_date);
