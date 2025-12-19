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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

