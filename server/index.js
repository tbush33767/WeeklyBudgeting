import express from 'express';
import cors from 'cors';
import expensesRouter from './routes/expenses.js';
import paycheckRouter from './routes/paychecks.js';
import incomeRouter from './routes/income.js';
import paidRouter from './routes/paid.js';
import rolloversRouter from './routes/rollovers.js';
import weeklyIncomeRouter from './routes/weeklyIncome.js';
import weeklyExpensesRouter from './routes/weeklyExpenses.js';
import quickExpensesRouter from './routes/quickExpenses.js';
import balancesRouter from './routes/balances.js';
import backupRouter from './routes/backup.js';
import dueDaysRouter from './routes/dueDays.js';
import scheduleRouter from './routes/schedule.js';

console.log('✅ All routes imported successfully');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for backup imports

// Routes
app.use('/api/expenses', expensesRouter);
app.use('/api/paycheck', paycheckRouter);
app.use('/api/income', incomeRouter);
app.use('/api/paid', paidRouter);
app.use('/api/rollovers', rolloversRouter);
app.use('/api/weekly-income', weeklyIncomeRouter);
app.use('/api/weekly-expenses', weeklyExpensesRouter);
app.use('/api/quick-expenses', quickExpensesRouter);
app.use('/api/balances', balancesRouter);
app.use('/api/backup', backupRouter);
app.use('/api/due-days', dueDaysRouter);
app.use('/api/schedule', scheduleRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database connection test
app.get('/api/test-db', async (req, res) => {
  try {
    const db = (await import('./db/database.js')).default;
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    res.json({ 
      status: 'connected', 
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(' ')[0] + ' ' + result.rows[0].pg_version.split(' ')[1]
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: error.message,
      stack: error.stack 
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from other devices: http://<your-ip>:${PORT}`);
});

