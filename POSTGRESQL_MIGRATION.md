# PostgreSQL Migration Guide

This guide will help you migrate from SQLite to PostgreSQL.

## Prerequisites

1. PostgreSQL is installed and running on your Proxmox server (192.168.68.68)
2. You have access to Adminer at `http://192.168.68.68/adminer/`
3. You know your PostgreSQL username and password

## Step 1: Create the Database in PostgreSQL

### Option A: Using Adminer (Web Interface)

1. Go to `http://192.168.68.68/adminer/`
2. Login with:
   - **System**: `pgsql`
   - **Server**: `localhost`
   - **Username**: `postgres` (or your username)
   - **Password**: (your PostgreSQL password)
   - **Database**: Leave empty or use `postgres`
3. Click "SQL command" or go to the SQL tab
4. Run this command to create the database:
   ```sql
   CREATE DATABASE budget;
   ```
5. Click "Execute"

### Option B: Using Command Line (SSH into container)

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE budget;

# Exit
\q
```

## Step 2: Install PostgreSQL Driver

In your project directory, install the PostgreSQL driver:

```bash
cd server
npm install pg
```

## Step 3: Install Dependencies

Install the PostgreSQL driver and dotenv package:

```bash
cd server
npm install
```

This will install `pg` (PostgreSQL driver) and `dotenv` (for loading .env files).

## Step 4: Create .env File

Create a `.env` file in the `server` directory with your database credentials:

```bash
cd server
nano .env
```

Add these lines (replace with your actual values):

```
DB_HOST=192.168.68.68
DB_PORT=5432
DB_NAME=budget
DB_USER=postgres
DB_PASSWORD=your_actual_password_here
```

Save the file (Ctrl+X, then Y, then Enter in nano).

**Important**: 
- The `.env` file is already in `.gitignore` to keep your password secure
- Never commit your `.env` file to git
- You can copy `server/.env.example` to `server/.env` and edit it

## Step 5: Initialize PostgreSQL Schema

### Option A: Using Adminer

1. Go to `http://192.168.68.68/adminer/`
2. Select the `budget` database
3. Click "SQL command"
4. Copy and paste the contents of `server/db/schema.postgresql.sql`
5. Click "Execute"

### Option B: Using Command Line

```bash
# From your local machine (if you have psql installed)
psql -h 192.168.68.68 -U postgres -d budget -f server/db/schema.postgresql.sql

# Or SSH into the container and run:
psql -U postgres -d budget -f /path/to/schema.postgresql.sql
```

## Step 6: Migrate Your Data

Run the migration script to copy all data from SQLite to PostgreSQL:

```bash
# Make sure you're in the server directory
cd server

# The script will automatically load the .env file
node migrate_to_postgresql.js
```

**That's it!** The script will automatically read your database credentials from `server/.env`.

If you prefer to set environment variables manually instead of using .env:

```bash
export DB_HOST=192.168.68.68
export DB_PORT=5432
export DB_NAME=budget
export DB_USER=postgres
export DB_PASSWORD=your_password_here
node migrate_to_postgresql.js
```

The script will:
- Connect to both databases
- Copy all tables and data
- Verify the migration was successful

## Step 7: Switch to PostgreSQL

Update `server/db/database.js` to use PostgreSQL:

```bash
# Backup the old SQLite version
cp server/db/database.js server/db/database.sqlite.js

# Use the PostgreSQL version
cp server/db/database.postgresql.js server/db/database.js
```

Or manually edit `server/db/database.js` and replace the content with the PostgreSQL version.

## Step 8: Test the Application

Start your server:

```bash
cd server
npm run dev
```

Test the application to make sure everything works. Check:
- Expenses load correctly
- Income loads correctly
- Payments work
- All features function as expected

## Step 9: Backup SQLite (Optional but Recommended)

Keep your SQLite database as a backup:

```bash
cp server/db/budget.db server/db/budget.db.backup
```

## Troubleshooting

### Connection Issues

If you can't connect to PostgreSQL:

1. **Check PostgreSQL is running:**
   ```bash
   # On the PostgreSQL container
   systemctl status postgresql
   ```

2. **Check firewall/network:**
   - Make sure port 5432 is accessible from your development machine
   - Check Proxmox firewall rules

3. **Check credentials:**
   - Verify username and password in Adminer
   - Make sure the database exists

### Migration Issues

If migration fails:

1. **Check table structure:**
   - Make sure schema was created successfully
   - Verify all tables exist in PostgreSQL

2. **Check data types:**
   - Some SQLite types might need conversion
   - Check the migration script output for errors

3. **Foreign key constraints:**
   - Make sure tables are migrated in the correct order
   - Check for orphaned records

### Performance

PostgreSQL should perform well, but if you notice issues:

1. Check connection pool settings in `database.postgresql.js`
2. Verify indexes were created (they're in the schema file)
3. Monitor PostgreSQL logs

## Rollback to SQLite

If you need to go back to SQLite:

```bash
# Restore the SQLite database file
cp server/db/database.sqlite.js server/db/database.js

# Restart the server
```

Your SQLite database file (`server/db/budget.db`) is still there and unchanged.

## Next Steps

Once everything is working:

1. ✅ Remove SQLite dependency (optional):
   ```bash
   npm uninstall better-sqlite3
   ```

2. ✅ Update your deployment scripts if needed

3. ✅ Set up regular PostgreSQL backups

4. ✅ Consider setting up connection pooling for production

## Support

If you encounter issues:
- Check PostgreSQL logs in the container
- Check application logs
- Verify all environment variables are set correctly
- Test connection using Adminer or psql

