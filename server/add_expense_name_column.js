/**
 * Migration script to add expense_name column to weekly_expense_schedule table
 * Run this once to add the column and populate it with expense names
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
    
    // Check if column already exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'weekly_expense_schedule' 
        AND column_name = 'expense_name'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log('📋 expense_name column already exists, checking position...');
      
      // Check current column order
      const columns = await client.query(`
        SELECT column_name, ordinal_position
        FROM information_schema.columns 
        WHERE table_name = 'weekly_expense_schedule'
        ORDER BY ordinal_position
      `);
      
      const expenseIdPos = columns.rows.findIndex(c => c.column_name === 'expense_id');
      const expenseNamePos = columns.rows.findIndex(c => c.column_name === 'expense_name');
      
      // If expense_name is already right after expense_id, we're done
      if (expenseNamePos === expenseIdPos + 1) {
        console.log('✅ Column is already in the correct position');
        
        // Just make sure it's populated and NOT NULL
        const result = await client.query(`
          UPDATE weekly_expense_schedule s
          SET expense_name = e.name
          FROM expenses e
          WHERE s.expense_id = e.id
            AND (s.expense_name IS NULL OR s.expense_name = '')
        `);
        
        if (result.rowCount > 0) {
          console.log(`✅ Updated ${result.rowCount} existing entries`);
        }
        
        await client.query('COMMIT');
        return;
      }
      
      console.log('🔄 Reordering columns (expense_name should be after expense_id)...');
    } else {
      console.log('📋 Adding expense_name column to weekly_expense_schedule...');
      
      // Add the column if it doesn't exist (will be at the end)
      await client.query(`
        ALTER TABLE weekly_expense_schedule 
        ADD COLUMN expense_name TEXT
      `);
      
      console.log('✅ Column added');
    }
    
    // Populate expense_name for existing entries
    console.log('🔄 Populating expense_name for existing entries...');
    
    const result = await client.query(`
      UPDATE weekly_expense_schedule s
      SET expense_name = e.name
      FROM expenses e
      WHERE s.expense_id = e.id
        AND (s.expense_name IS NULL OR s.expense_name = '')
    `);
    
    console.log(`✅ Updated ${result.rowCount} existing entries`);
    
    // Make the column NOT NULL after populating
    await client.query(`
      ALTER TABLE weekly_expense_schedule 
      ALTER COLUMN expense_name SET NOT NULL
    `);
    
    console.log('✅ Column set to NOT NULL');
    
    // Note: PostgreSQL doesn't support reordering columns directly
    // The column will be at the end, but functionally it works the same
    // If you need it in a specific position, you'd need to recreate the table
    console.log('ℹ️  Note: Column is at the end of the table. Functionally equivalent.');
    
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

