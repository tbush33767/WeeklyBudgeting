import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create or open the database
const db = new Database(join(__dirname, 'budget.db'));

// Enable foreign keys
db.pragma('journal_mode = WAL');

// Initialize schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Migration: Add start_date column to income table if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(income)").all();
  const hasStartDate = columns.some(col => col.name === 'start_date');
  if (!hasStartDate) {
    db.exec('ALTER TABLE income ADD COLUMN start_date TEXT');
    console.log('Added start_date column to income table');
  }
} catch (e) {
  // Table might not exist yet, that's ok
}

// Migration: Add start_date column to expenses table if it doesn't exist
try {
  const columns = db.prepare("PRAGMA table_info(expenses)").all();
  const hasStartDate = columns.some(col => col.name === 'start_date');
  if (!hasStartDate) {
    db.exec('ALTER TABLE expenses ADD COLUMN start_date TEXT');
    console.log('Added start_date column to expenses table');
  }
} catch (e) {
  // Table might not exist yet, that's ok
}

// Migration: Add amount_paid column to paid_expenses for partial payments
try {
  const columns = db.prepare("PRAGMA table_info(paid_expenses)").all();
  const hasAmountPaid = columns.some(col => col.name === 'amount_paid');
  if (!hasAmountPaid) {
    // Add the amount_paid column
    db.exec('ALTER TABLE paid_expenses ADD COLUMN amount_paid REAL');
    
    // Update existing records to use the full expense amount
    db.exec(`
      UPDATE paid_expenses 
      SET amount_paid = (
        SELECT amount FROM expenses WHERE expenses.id = paid_expenses.expense_id
      )
      WHERE amount_paid IS NULL
    `);
    console.log('Added amount_paid column to paid_expenses table');
  }
} catch (e) {
  // Table might not exist yet, that's ok
}

export default db;

