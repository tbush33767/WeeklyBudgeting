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

export default db;

