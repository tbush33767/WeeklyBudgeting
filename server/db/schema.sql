-- Expenses table for bills, living expenses, debts, and savings
CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('bill', 'living', 'debt', 'savings')),
    frequency TEXT NOT NULL CHECK (frequency IN ('one-time', 'weekly', 'biweekly', 'monthly')),
    due_day INTEGER CHECK (due_day >= 1 AND due_day <= 31),
    start_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Income sources table
CREATE TABLE IF NOT EXISTS income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    pay_day INTEGER NOT NULL DEFAULT 5 CHECK (pay_day >= 0 AND pay_day <= 6),
    start_date TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Track paid expenses per week (supports partial payments)
CREATE TABLE IF NOT EXISTS paid_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    amount_paid REAL NOT NULL,
    paid_date TEXT DEFAULT CURRENT_TIMESTAMP,
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
INSERT OR IGNORE INTO paycheck (id, amount, frequency, pay_day) VALUES (1, 0, 'biweekly', 5);

-- Week rollovers (money left over from previous week)
CREATE TABLE IF NOT EXISTS week_rollovers (
    week_start TEXT PRIMARY KEY,
    rollover_amount REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Track actual income received per week (allows overriding expected amount)
CREATE TABLE IF NOT EXISTS weekly_income (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    income_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    actual_amount REAL NOT NULL,
    received INTEGER DEFAULT 1,
    received_date TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(income_id, week_start),
    FOREIGN KEY (income_id) REFERENCES income(id) ON DELETE CASCADE
);

-- Quick expenses (one-off, non-budgeted expenses per week)
CREATE TABLE IF NOT EXISTS quick_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Weekly actual balance tracking
CREATE TABLE IF NOT EXISTS week_balances (
    week_start TEXT PRIMARY KEY,
    actual_balance REAL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Track expense amount overrides per week (allows modifying a single bill occurrence)
CREATE TABLE IF NOT EXISTS weekly_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_id INTEGER NOT NULL,
    week_start TEXT NOT NULL,
    actual_amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(expense_id, week_start),
    FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
);

