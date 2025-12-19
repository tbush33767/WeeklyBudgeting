import express from 'express';
import cors from 'cors';
import expensesRouter from './routes/expenses.js';
import paycheckRouter from './routes/paychecks.js';
import incomeRouter from './routes/income.js';
import paidRouter from './routes/paid.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/expenses', expensesRouter);
app.use('/api/paycheck', paycheckRouter);
app.use('/api/income', incomeRouter);
app.use('/api/paid', paidRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

