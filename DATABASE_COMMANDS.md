# Database Viewing Commands

The database is located at: `server/db/budget.db`

## Quick View Commands

### View all expenses:
```bash
sqlite3 server/db/budget.db "SELECT id, name, amount, frequency, due_day, is_active FROM expenses ORDER BY name;"
```

### View expenses in a formatted table:
```bash
sqlite3 server/db/budget.db -header -column "SELECT id, name, amount, frequency, due_day, is_active FROM expenses ORDER BY name;"
```

### Find duplicate expense names:
```bash
sqlite3 server/db/budget.db "SELECT name, COUNT(*) as count FROM expenses GROUP BY name HAVING count > 1;"
```

### View all expenses with full details:
```bash
sqlite3 server/db/budget.db -header -column "SELECT * FROM expenses ORDER BY name;"
```

### View due date overrides:
```bash
sqlite3 server/db/budget.db -header -column "SELECT * FROM weekly_due_days ORDER BY week_start DESC, expense_id;"
```

### View expense overrides (modified amounts):
```bash
sqlite3 server/db/budget.db -header -column "SELECT * FROM weekly_expenses ORDER BY week_start DESC;"
```

### View all tables:
```bash
sqlite3 server/db/budget.db ".tables"
```

### View table structure:
```bash
sqlite3 server/db/budget.db ".schema expenses"
```

## Interactive Mode

To open an interactive SQLite session:
```bash
sqlite3 server/db/budget.db
```

Then you can run SQL commands directly:
```sql
SELECT * FROM expenses;
.quit
```

## Useful Queries

### Find expenses by name:
```bash
sqlite3 server/db/budget.db "SELECT * FROM expenses WHERE name LIKE '%Home Equity%';"
```

### Count total expenses:
```bash
sqlite3 server/db/budget.db "SELECT COUNT(*) FROM expenses WHERE is_active = 1;"
```

### View expenses with their overrides for a specific week:
```bash
sqlite3 server/db/budget.db "SELECT e.id, e.name, e.amount, we.actual_amount, e.amount - we.actual_amount as difference FROM expenses e LEFT JOIN weekly_expenses we ON e.id = we.expense_id WHERE we.week_start = '2026-01-02';"
```

## Delete Commands (USE WITH CAUTION)

### Delete a specific expense by ID:
```bash
sqlite3 server/db/budget.db "DELETE FROM expenses WHERE id = 24;"
```

### Delete duplicate expenses (keeps the one with the lowest ID):
```bash
sqlite3 server/db/budget.db "DELETE FROM expenses WHERE id NOT IN (SELECT MIN(id) FROM expenses GROUP BY name);"
```

**WARNING**: Always backup your database before deleting! You can backup with:
```bash
cp server/db/budget.db server/db/budget.db.backup
```

