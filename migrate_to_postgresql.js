#!/usr/bin/env node
/**
 * Migration script to move data from SQLite to PostgreSQL
 * 
 * Usage:
 * 1. Create a .env file in the server directory with:
 *    DB_HOST=192.168.68.68
 *    DB_PORT=5432
 *    DB_NAME=budget
 *    DB_USER=postgres
 *    DB_PASSWORD=your_password
 * 
 * 2. Run: node migrate_to_postgresql.js
 * 
 * OR set environment variables manually:
 *    export DB_HOST=192.168.68.68
 *    export DB_PORT=5432
 *    export DB_NAME=budget
 *    export DB_USER=postgres
 *    export DB_PASSWORD=your_password
 *    node migrate_to_postgresql.js
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env file from server directory
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

// SQLite database (assuming script is run from server directory)
const sqliteDb = new Database(join(__dirname, 'db/budget.db'));

// PostgreSQL connection
const { Pool } = pg;
const pool = new Pool({
  host: process.env.DB_HOST || '192.168.68.68',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'budget',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

console.log('Starting migration from SQLite to PostgreSQL...\n');

// Helper to convert SQLite row to PostgreSQL format
const convertRow = (row) => {
  const converted = {};
  for (const [key, value] of Object.entries(row)) {
    // Convert undefined to null
    converted[key] = value === undefined ? null : value;
  }
  return converted;
};

// Migrate a table
const migrateTable = async (tableName, columns, transformRow = null) => {
  try {
    console.log(`Migrating ${tableName}...`);
    
    // Get all rows from SQLite
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
    
    if (rows.length === 0) {
      console.log(`  No data to migrate for ${tableName}`);
      return;
    }

    // Build INSERT query
    const columnNames = columns || Object.keys(rows[0]);
    const placeholders = columnNames.map((_, i) => `$${i + 1}`).join(', ');
    const insertQuery = `
      INSERT INTO ${tableName} (${columnNames.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT DO NOTHING
    `;

    // Insert rows
    let inserted = 0;
    for (const row of rows) {
      const convertedRow = transformRow ? transformRow(row) : convertRow(row);
      const values = columnNames.map(col => convertedRow[col]);
      
      try {
        const result = await pool.query(insertQuery, values);
        if (result.rowCount > 0) inserted++;
      } catch (error) {
        console.error(`  Error inserting row into ${tableName}:`, error.message);
        console.error('  Row:', convertedRow);
      }
    }

    console.log(`  Migrated ${inserted} of ${rows.length} rows from ${tableName}`);
  } catch (error) {
    console.error(`Error migrating ${tableName}:`, error.message);
  }
};

// Main migration function
const migrate = async () => {
  try {
    // Test PostgreSQL connection
    await pool.query('SELECT 1');
    console.log('✓ Connected to PostgreSQL\n');

    // Migrate tables in order (respecting foreign keys)
    await migrateTable('expenses');
    await migrateTable('income');
    await migrateTable('paycheck');
    await migrateTable('week_rollovers');
    await migrateTable('weekly_income');
    await migrateTable('quick_expenses');
    await migrateTable('week_balances');
    await migrateTable('weekly_expenses');
    await migrateTable('paid_expenses');
    await migrateTable('weekly_due_days');

    console.log('\n✓ Migration completed!');
    
    // Verify counts
    console.log('\nVerifying data...');
    const tables = ['expenses', 'income', 'paid_expenses', 'weekly_expenses', 'weekly_due_days'];
    for (const table of tables) {
      try {
        const sqliteCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get().count;
        const pgResult = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
        const pgCount = parseInt(pgResult.rows[0].count);
        console.log(`  ${table}: SQLite=${sqliteCount}, PostgreSQL=${pgCount}`);
      } catch (e) {
        // Table might not exist
      }
    }

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pool.end();
  }
};

// Run migration
migrate();

