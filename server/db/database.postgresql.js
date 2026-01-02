import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Load .env file from server directory (parent of db directory)
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

// PostgreSQL connection configuration
// You can set these via environment variables or update directly
const dbConfig = {
  host: process.env.DB_HOST || '192.168.68.68',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'budget',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '', // Set this via environment variable for security
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Validate password is set and is a string
if (!dbConfig.password || typeof dbConfig.password !== 'string') {
  console.error('⚠️  ERROR: DB_PASSWORD is not set or is invalid in .env file!');
  console.error('   Please check server/.env file and ensure DB_PASSWORD is set.');
  console.error('   Example format:');
  console.error('   DB_PASSWORD=your_actual_password');
  console.error('');
  console.error('   Current values:');
  console.error(`   DB_HOST: ${dbConfig.host}`);
  console.error(`   DB_PORT: ${dbConfig.port}`);
  console.error(`   DB_NAME: ${dbConfig.database}`);
  console.error(`   DB_USER: ${dbConfig.user}`);
  console.error(`   DB_PASSWORD: ${dbConfig.password ? '***' : '(empty or undefined)'}`);
  process.exit(1);
}

// Ensure password is a string (in case it's read as something else)
dbConfig.password = String(dbConfig.password);

const pool = new Pool(dbConfig);

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize schema
const initializeSchema = async () => {
  try {
    // Check if schema file exists
    try {
      const schema = readFileSync(join(__dirname, 'schema.postgresql.sql'), 'utf-8');
      // Only run CREATE TABLE statements if tables don't exist
      // The schema should already be initialized via Adminer or migration
      // So we'll skip this to avoid errors
      // await pool.query(schema);
      // console.log('Database schema initialized');
    } catch (fileError) {
      // Schema file might not exist, that's ok - tables should already be created
      console.log('Schema file not found, assuming tables already exist');
    }
  } catch (error) {
    console.error('Error initializing schema:', error.message);
    // Don't throw - schema might already exist
  }
};

// Run migrations
const runMigrations = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Migration: Add start_date column to income table if it doesn't exist
    try {
      const result = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'income' AND column_name = 'start_date'
      `);
      if (result.rows.length === 0) {
        await client.query('ALTER TABLE income ADD COLUMN start_date TEXT');
        console.log('Added start_date column to income table');
      }
    } catch (e) {
      // Column might already exist or table doesn't exist yet
    }

    // Migration: Add start_date column to expenses table if it doesn't exist
    try {
      const result = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'expenses' AND column_name = 'start_date'
      `);
      if (result.rows.length === 0) {
        await client.query('ALTER TABLE expenses ADD COLUMN start_date TEXT');
        console.log('Added start_date column to expenses table');
      }
    } catch (e) {
      // Column might already exist or table doesn't exist yet
    }

    // Migration: Add amount_paid column to paid_expenses for partial payments
    try {
      const result = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'paid_expenses' AND column_name = 'amount_paid'
      `);
      if (result.rows.length === 0) {
        await client.query('ALTER TABLE paid_expenses ADD COLUMN amount_paid REAL');
        
        // Update existing records to use the full expense amount
        await client.query(`
          UPDATE paid_expenses 
          SET amount_paid = (
            SELECT amount FROM expenses WHERE expenses.id = paid_expenses.expense_id
          )
          WHERE amount_paid IS NULL
        `);
        console.log('Added amount_paid column to paid_expenses table');
      }
    } catch (e) {
      // Column might already exist or table doesn't exist yet
    }

    // Migration: Create weekly_due_days table if it doesn't exist
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS weekly_due_days (
          id SERIAL PRIMARY KEY,
          expense_id INTEGER NOT NULL,
          week_start TEXT NOT NULL,
          due_date TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(expense_id, week_start),
          FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
        )
      `);
      console.log('Created weekly_due_days table');
    } catch (e) {
      // Table might already exist, that's ok
      console.log('weekly_due_days table check completed');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error.message);
  } finally {
    client.release();
  }
};

// Initialize on module load (but don't block)
// Schema should already be created, so we just run migrations
initializeSchema().then(() => {
  runMigrations().catch(err => {
    console.error('Migration error (non-fatal):', err.message);
  });
}).catch(err => {
  console.error('Schema initialization error (non-fatal):', err.message);
});

// Helper to convert SQLite ? placeholders to PostgreSQL $1, $2, etc.
const convertPlaceholders = (query) => {
  let paramIndex = 1;
  return query.replace(/\?/g, () => `$${paramIndex++}`);
};

// Export a query helper that matches better-sqlite3 API style
// Note: This is a compatibility layer - routes need to use async/await
const db = {
  // Query method (returns promise)
  query: (text, params) => {
    const convertedQuery = convertPlaceholders(text);
    return pool.query(convertedQuery, params);
  },
  
  // Prepare-like method for prepared statements (returns a function)
  // Converts ? placeholders to $1, $2, etc. for PostgreSQL
  prepare: (text) => {
    const queryText = convertPlaceholders(text);
    return {
      get: async (...params) => {
        const result = await pool.query(queryText, params);
        return result.rows[0] || null;
      },
      all: async (...params) => {
        const result = await pool.query(queryText, params);
        return result.rows;
      },
      run: async (...params) => {
        const result = await pool.query(queryText, params);
        return {
          lastInsertRowid: result.rows[0]?.id || null,
          changes: result.rowCount || 0,
          rows: result.rows // Add rows for RETURNING clauses
        };
      }
    };
  },
  
  // Exec-like method for multiple statements
  exec: async (sql) => {
    await pool.query(sql);
  },
  
  // Close connection pool
  close: async () => {
    await pool.end();
  }
};

export default db;

