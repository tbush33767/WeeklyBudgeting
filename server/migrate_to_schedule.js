/**
 * Migration script to create schedule tables and populate them
 * Run this after creating the tables in the database
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'budget',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Helper to convert ? placeholders to PostgreSQL $1, $2, etc.
const convertPlaceholders = (query) => {
  let paramIndex = 1;
  return query.replace(/\?/g, () => `$${paramIndex++}`);
};

const query = async (text, params) => {
  const convertedQuery = convertPlaceholders(text);
  return pool.query(convertedQuery, params);
};

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📋 Creating schedule tables...');
    
    // Create expense schedule table
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_expense_schedule (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER NOT NULL,
        week_start TEXT NOT NULL,
        due_date TEXT NOT NULL,
        amount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(expense_id, week_start),
        FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
      )
    `);
    
    // Create income schedule table
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_income_schedule (
        id SERIAL PRIMARY KEY,
        income_id INTEGER NOT NULL,
        week_start TEXT NOT NULL,
        pay_date TEXT NOT NULL,
        amount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(income_id, week_start),
        FOREIGN KEY (income_id) REFERENCES income(id) ON DELETE CASCADE
      )
    `);
    
    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_expense_schedule_week_start 
      ON weekly_expense_schedule(week_start)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_expense_schedule_due_date 
      ON weekly_expense_schedule(due_date)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_income_schedule_week_start 
      ON weekly_income_schedule(week_start)
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_weekly_income_schedule_pay_date 
      ON weekly_income_schedule(pay_date)
    `);
    
    console.log('✅ Schedule tables created');
    
    // Migrate existing due date overrides to schedule
    console.log('🔄 Migrating existing due date overrides...');
    
    const dueDateOverrides = await client.query(`
      SELECT expense_id, week_start, due_date 
      FROM weekly_due_days
    `);
    
    for (const override of dueDateOverrides.rows) {
      // Get the expense to get the amount
      const expense = await client.query(
        'SELECT amount FROM expenses WHERE id = $1',
        [override.expense_id]
      );
      
      if (expense.rows.length > 0) {
        await client.query(`
          INSERT INTO weekly_expense_schedule (expense_id, week_start, due_date, amount)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (expense_id, week_start) DO UPDATE SET
            due_date = EXCLUDED.due_date
        `, [override.expense_id, override.week_start, override.due_date, expense.rows[0].amount]);
      }
    }
    
    console.log(`✅ Migrated ${dueDateOverrides.rows.length} due date overrides`);
    
    // Migrate existing weekly_expenses (amount overrides) to schedule
    console.log('🔄 Migrating existing amount overrides...');
    
    const amountOverrides = await client.query(`
      SELECT expense_id, week_start, actual_amount
      FROM weekly_expenses
      WHERE (expense_id, week_start) NOT IN (
        SELECT expense_id, week_start FROM weekly_expense_schedule
      )
    `);
    
    for (const override of amountOverrides.rows) {
      // Get the expense to calculate default due date
      const expense = await client.query(
        'SELECT due_day FROM expenses WHERE id = $1',
        [override.expense_id]
      );
      
      if (expense.rows.length > 0 && expense.rows[0].due_day) {
        // Calculate default due date for this week
        const weekStart = new Date(override.week_start);
        const year = weekStart.getFullYear();
        const month = weekStart.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(expense.rows[0].due_day, lastDay);
        const dueDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        await client.query(`
          INSERT INTO weekly_expense_schedule (expense_id, week_start, due_date, amount)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (expense_id, week_start) DO UPDATE SET
            amount = EXCLUDED.amount
        `, [override.expense_id, override.week_start, dueDate, override.actual_amount]);
      }
    }
    
    console.log(`✅ Migrated ${amountOverrides.rows.length} amount overrides`);
    
    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration
migrate()
  .then(() => {
    console.log('Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration error:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });

