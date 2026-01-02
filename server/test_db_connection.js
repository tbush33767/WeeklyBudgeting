#!/usr/bin/env node
/**
 * Test PostgreSQL database connection
 */

import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || '192.168.68.68',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'budget',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

console.log('Testing PostgreSQL connection...');
console.log('');
console.log('Configuration:');
console.log(`  Host: ${pool.options.host}`);
console.log(`  Port: ${pool.options.port}`);
console.log(`  Database: ${pool.options.database}`);
console.log(`  User: ${pool.options.user}`);
console.log(`  Password: ${pool.options.password ? '***' + pool.options.password.slice(-2) : '(NOT SET)'}`);
console.log('');

if (!pool.options.password) {
  console.error('❌ ERROR: DB_PASSWORD is not set in .env file!');
  console.error('');
  console.error('Please check your server/.env file and ensure it contains:');
  console.error('  DB_PASSWORD=your_actual_password');
  process.exit(1);
}

try {
  const result = await pool.query('SELECT NOW() as current_time, version() as pg_version');
  console.log('✅ Connection successful!');
  console.log('');
  console.log('PostgreSQL Info:');
  console.log(`  Current Time: ${result.rows[0].current_time}`);
  console.log(`  Version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
  console.log('');
  
  // Test if budget database exists
  const dbCheck = await pool.query("SELECT datname FROM pg_database WHERE datname = 'budget'");
  if (dbCheck.rows.length > 0) {
    console.log('✅ Database "budget" exists');
  } else {
    console.log('⚠️  Database "budget" does not exist');
    console.log('   Run: CREATE DATABASE budget; in PostgreSQL');
  }
  
  await pool.end();
  process.exit(0);
} catch (error) {
  console.error('❌ Connection failed!');
  console.error('');
  console.error('Error:', error.message);
  console.error('');
  console.error('Common issues:');
  console.error('  1. Password is incorrect');
  console.error('  2. Database "budget" does not exist');
  console.error('  3. PostgreSQL is not running');
  console.error('  4. Network/firewall blocking connection');
  await pool.end();
  process.exit(1);
}

