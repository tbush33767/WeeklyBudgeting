import { useMemo } from 'react';
import { startOfWeek, endOfWeek, addDays } from 'date-fns';
import './Dashboard.css';

const categoryConfig = {
  bill: { label: 'Bills', icon: 'receipt_long', color: 'var(--color-bill)' },
  living: { label: 'Living Expenses', icon: 'home', color: 'var(--color-living)' },
  debt: { label: 'Debts', icon: 'credit_card', color: 'var(--color-debt)' },
  savings: { label: 'Savings', icon: 'savings', color: 'var(--color-savings)' },
};

// Helper to check if biweekly income applies to a given week
const isBiweeklyPayWeek = (incomeStartDate, weekStartDate) => {
  if (!incomeStartDate) {
    // Fallback for entries without start_date - use week number
    const weekStart = new Date(weekStartDate);
    const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
    const weekNum = Math.floor((weekStart.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekNum % 2 === 0;
  }
  const start = new Date(incomeStartDate);
  const weekStart = new Date(weekStartDate);
  const diffTime = weekStart.getTime() - start.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks % 2 === 0;
};

export default function Dashboard({ expenses, income, selectedDate }) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Get days in the week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  // Calculate total income for this specific week
  const weeklyIncome = useMemo(() => {
    return income.reduce((sum, inc) => {
      if (!inc.is_active) return sum;
      
      if (inc.frequency === 'weekly') {
        return sum + inc.amount;
      } else if (inc.frequency === 'biweekly') {
        if (isBiweeklyPayWeek(inc.start_date, weekStartStr)) {
          return sum + inc.amount;
        }
        return sum;
      } else if (inc.frequency === 'monthly') {
        return sum + (inc.amount * 12) / 52;
      }
      return sum;
    }, 0);
  }, [income, weekStartStr]);

  // Filter expenses for this week
  const weeklyExpenses = useMemo(() => {
    const startOfYear = new Date(selectedDate.getFullYear(), 0, 1);
    const weekNum = Math.floor((weekStart.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    
    return expenses.filter(expense => {
      if (!expense.is_active) return false;

      if (expense.frequency === 'weekly') {
        return true;
      } else if (expense.frequency === 'biweekly') {
        return weekNum % 2 === 0;
      } else if (expense.due_day) {
        // Check if due_day falls within this week
        return weekDays.some(day => day.getDate() === expense.due_day);
      }
      return false;
    });
  }, [expenses, selectedDate, weekDays, weekStart]);

  const summaries = useMemo(() => {
    const result = {};
    for (const category of Object.keys(categoryConfig)) {
      const categoryExpenses = weeklyExpenses.filter(e => e.category === category);
      result[category] = {
        count: categoryExpenses.length,
        total: categoryExpenses.reduce((sum, e) => sum + e.amount, 0),
      };
    }
    return result;
  }, [weeklyExpenses]);

  const totalExpenses = Object.values(summaries).reduce((sum, s) => sum + s.total, 0);
  const remaining = weeklyIncome - totalExpenses;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Budget Overview</h2>
        <div className="paycheck-summary">
          <span className="label">This Week's Income</span>
          <span className="amount">${Math.round(weeklyIncome).toLocaleString()}</span>
        </div>
      </div>

      <div className="category-cards">
        {Object.entries(categoryConfig).map(([key, config]) => (
          <div key={key} className="category-card" style={{ '--accent': config.color }}>
            <div className="card-header">
              <span className="material-symbols-rounded icon">{config.icon}</span>
              <span className="label">{config.label}</span>
            </div>
            <div className="card-body">
              <span className="amount">-${summaries[key].total.toLocaleString()}</span>
              <span className="count">{summaries[key].count} items</span>
            </div>
          </div>
        ))}
      </div>

      <div className="balance-bar">
        <div className="balance-info">
          <div className="balance-item">
            <span className="label">Total Expenses</span>
            <span className="amount expense">-${totalExpenses.toLocaleString()}</span>
          </div>
          <div className="balance-item">
            <span className="label">Remaining</span>
            <span className={`amount ${remaining >= 0 ? 'positive' : 'negative'}`}>
              ${Math.round(remaining).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="progress-container">
          <div 
            className="progress-bar"
            style={{ width: `${weeklyIncome > 0 ? Math.min((totalExpenses / weeklyIncome) * 100, 100) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}
