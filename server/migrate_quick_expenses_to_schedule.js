/**
 * Migration script to add quick expenses to weekly_expense_schedule table
 * Run this once to migrate existing quick expenses to the schedule table
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

async function migrate() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('📋 Migrating quick expenses to weekly_expense_schedule...');
    
    // First, update the schema to support quick expenses
    console.log('🔄 Updating schema...');
    
    // Make expense_id nullable
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      ALTER COLUMN expense_id DROP NOT NULL
    `).catch(() => {
      console.log('Note: expense_id may already be nullable');
    });
    
    // Add new columns if they don't exist
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      ADD COLUMN IF NOT EXISTS is_quick_expense INTEGER DEFAULT 0
    `);
    
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      ADD COLUMN IF NOT EXISTS quick_expense_id INTEGER
    `);
    
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      ADD COLUMN IF NOT EXISTS note TEXT
    `);
    
    // Make amount NOT NULL if it isn't already
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      ALTER COLUMN amount SET NOT NULL
    `).catch(() => {
      console.log('Note: amount may already be NOT NULL');
    });
    
    // Drop old unique constraint and add new ones
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      DROP CONSTRAINT IF EXISTS weekly_expense_schedule_expense_id_week_start_key
    `).catch(() => {
      // Ignore if constraint doesn't exist
    });
    
    // Add partial unique constraints
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS weekly_expense_schedule_expense_week_unique 
      ON weekly_expense_schedule (expense_id, week_start) 
      WHERE expense_id IS NOT NULL
    `);
    
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS weekly_expense_schedule_quick_expense_unique 
      ON weekly_expense_schedule (quick_expense_id) 
      WHERE quick_expense_id IS NOT NULL
    `);
    
    // Add foreign key for quick_expense_id if it doesn't exist
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'weekly_expense_schedule_quick_expense_id_fkey'
        ) THEN
          ALTER TABLE weekly_expense_schedule 
          ADD CONSTRAINT weekly_expense_schedule_quick_expense_id_fkey 
          FOREIGN KEY (quick_expense_id) REFERENCES quick_expenses(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    
    console.log('✅ Schema updated');
    
    // Get all quick expenses that aren't already in the schedule
    const quickExpenses = await client.query(`
      SELECT q.* 
      FROM quick_expenses q
      LEFT JOIN weekly_expense_schedule s ON s.quick_expense_id = q.id
      WHERE s.id IS NULL
    `);
    
    console.log(`🔄 Migrating ${quickExpenses.rows.length} quick expenses...`);
    
    // Insert each quick expense into the schedule
    for (const qe of quickExpenses.rows) {
      await client.query(`
        INSERT INTO weekly_expense_schedule (
          expense_id, expense_name, week_start, due_date, amount,
          is_quick_expense, quick_expense_id, note
        )
        VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        null,  // expense_id is NULL for quick expenses
        qe.name,
        qe.week_start,
        qe.week_start,  // Use week_start as due_date
        qe.amount,
        qe.id,
        qe.note || null
      ]);
    }
    
    console.log(`✅ Migrated ${quickExpenses.rows.length} quick expenses`);
    
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

