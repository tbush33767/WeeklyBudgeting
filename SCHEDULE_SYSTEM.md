# Weekly Schedule System

## Overview

The new schedule system uses explicit tables to track which expenses and income appear in which week. This makes it much simpler to:
- See what's scheduled for any week
- Modify due dates for specific occurrences
- Handle one-time changes (like a missed payment moved to next week)
- Understand exactly what's happening without complex date calculations

## New Tables

### `weekly_expense_schedule`
Explicitly tracks which expenses appear in which week:
- `expense_id` - The expense
- `week_start` - The week this expense appears in
- `due_date` - The actual date this expense is due (YYYY-MM-DD)
- `amount` - Optional override amount (if different from expense.amount)

### `weekly_income_schedule`
Explicitly tracks which income appears in which week:
- `income_id` - The income source
- `week_start` - The week this income appears in
- `pay_date` - The actual date this income is received (YYYY-MM-DD)
- `amount` - Optional override amount (if different from income.amount)

## How It Works

### Automatic Scheduling
When you first view a week, the system can automatically populate the schedule based on:
- Expense/income frequency (weekly, biweekly, monthly)
- Due days and pay days
- Start dates

### Manual Overrides
When you modify a due date or add an expense to a week:
1. An entry is created in `weekly_expense_schedule`
2. This entry explicitly says "this expense appears in this week on this date"
3. Future weeks automatically use the default schedule unless you override them

### Benefits
- **Explicit**: You can see exactly what's scheduled for any week
- **Simple**: No complex date calculations needed
- **Flexible**: Easy to add/remove/modify entries
- **Clear**: One-time changes are obvious in the database

## Migration

The migration script will:
1. Create the new schedule tables
2. Populate them based on existing expenses/income
3. Migrate existing due date overrides to the schedule

## API Endpoints

### Expense Schedule
- `GET /api/schedule/expenses/:weekStart` - Get all scheduled expenses for a week
- `PUT /api/schedule/expenses/:expenseId/:weekStart` - Add/update expense in schedule
- `DELETE /api/schedule/expenses/:expenseId/:weekStart` - Remove expense from schedule

### Income Schedule
- `GET /api/schedule/income/:weekStart` - Get all scheduled income for a week
- `PUT /api/schedule/income/:incomeId/:weekStart` - Add/update income in schedule
- `DELETE /api/schedule/income/:incomeId/:weekStart` - Remove income from schedule

## Next Steps

1. Run the migration script to create tables and populate initial schedule
2. Update frontend to use schedule tables instead of calculating dates
3. Gradually migrate from old system to new system

