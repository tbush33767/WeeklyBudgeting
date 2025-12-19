import { useMemo, useState, useEffect } from 'react';
import { startOfWeek, endOfWeek, addDays, addWeeks, format, lastDayOfMonth } from 'date-fns';
import { fetchWeeklyIncome, fetchWeeklyExpenseOverrides, fetchRollover, fetchQuickExpenses } from '../api/expenses';
import './Dashboard.css';

const categoryConfig = {
  bill: { label: 'Bills', icon: 'receipt_long', color: '#6366f1' },      // Indigo
  living: { label: 'Living Expenses', icon: 'home', color: '#8b5cf6' },  // Purple
  debt: { label: 'Debts', icon: 'credit_card', color: '#ec4899' },       // Pink
  savings: { label: 'Savings', icon: 'savings', color: '#06b6d4' },      // Cyan
};

// Helper to get the effective due day for a given month
// If due_day is 31 but month only has 30 days, returns 30
const getEffectiveDueDay = (dueDay, date) => {
  const lastDay = lastDayOfMonth(date).getDate();
  return Math.min(dueDay, lastDay);
};

// Helper to check if biweekly item applies to a given week (works for both income and expenses)
const isBiweeklyWeek = (startDate, weekStartDate) => {
  if (!startDate) {
    // Fallback for entries without start_date - use week number
    const weekStart = new Date(weekStartDate);
    const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
    const weekNum = Math.floor((weekStart.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return weekNum % 2 === 0;
  }
  const start = new Date(startDate);
  const weekStart = new Date(weekStartDate);
  const diffTime = weekStart.getTime() - start.getTime();
  const diffWeeks = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks % 2 === 0;
};

export default function Dashboard({ expenses, income, selectedDate }) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  
  // Calculate next week's date range for warning
  const nextWeekStart = addWeeks(weekStart, 1);
  const nextWeekStartStr = format(nextWeekStart, 'yyyy-MM-dd');
  const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 5 });

  // Income overrides state
  const [incomeOverrides, setIncomeOverrides] = useState({});
  // Expense overrides state
  const [expenseOverrides, setExpenseOverrides] = useState({});
  // Rollover state
  const [rollover, setRollover] = useState(0);
  // Quick expenses state
  const [quickExpenses, setQuickExpenses] = useState([]);
  // Expanded category state
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Load income overrides
  useEffect(() => {
    const loadIncomeOverrides = async () => {
      try {
        const data = await fetchWeeklyIncome(weekStartStr);
        const overrides = {};
        data.forEach(item => {
          overrides[item.income_id] = {
            actual_amount: item.actual_amount,
            received: item.received
          };
        });
        setIncomeOverrides(overrides);
      } catch (err) {
        console.error('Failed to load income overrides:', err);
      }
    };
    loadIncomeOverrides();
  }, [weekStartStr]);

  // Load expense overrides for current week
  useEffect(() => {
    const loadExpenseOverrides = async () => {
      try {
        const data = await fetchWeeklyExpenseOverrides(weekStartStr);
        const overrides = {};
        data.forEach(item => {
          overrides[item.expense_id] = item.actual_amount;
        });
        setExpenseOverrides(overrides);
      } catch (err) {
        console.error('Failed to load expense overrides:', err);
      }
    };
    loadExpenseOverrides();
  }, [weekStartStr]);

  // State for next week's expense overrides
  const [nextWeekExpenseOverrides, setNextWeekExpenseOverrides] = useState({});

  // Load expense overrides for next week (for warning calculation)
  useEffect(() => {
    const loadNextWeekOverrides = async () => {
      try {
        const data = await fetchWeeklyExpenseOverrides(nextWeekStartStr);
        const overrides = {};
        data.forEach(item => {
          overrides[item.expense_id] = item.actual_amount;
        });
        setNextWeekExpenseOverrides(overrides);
      } catch (err) {
        console.error('Failed to load next week expense overrides:', err);
      }
    };
    loadNextWeekOverrides();
  }, [nextWeekStartStr]);

  // Load rollover
  useEffect(() => {
    const loadRollover = async () => {
      try {
        const data = await fetchRollover(weekStartStr);
        setRollover(data.rollover_amount || 0);
      } catch (err) {
        console.error('Failed to load rollover:', err);
      }
    };
    loadRollover();
  }, [weekStartStr]);

  // Load quick expenses
  useEffect(() => {
    const loadQuickExpenses = async () => {
      try {
        const data = await fetchQuickExpenses(weekStartStr);
        setQuickExpenses(data);
      } catch (err) {
        console.error('Failed to load quick expenses:', err);
      }
    };
    loadQuickExpenses();
  }, [weekStartStr]);

  // Get actual income amount (using override if available)
  const getActualIncome = (inc) => {
    const override = incomeOverrides[inc.id];
    return override ? override.actual_amount : inc.amount;
  };

  // Get actual expense amount (using override if available)
  const getActualExpense = (expense) => {
    return expenseOverrides[expense.id] ?? expense.amount;
  };

  // Get days in the week
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

  // Calculate total income for this specific week (using actual amounts)
  const weeklyIncome = useMemo(() => {
    return income.reduce((sum, inc) => {
      if (!inc.is_active) return sum;
      
      const amount = getActualIncome(inc);
      
      if (inc.frequency === 'weekly') {
        return sum + amount;
      } else if (inc.frequency === 'biweekly') {
        if (isBiweeklyWeek(inc.start_date, weekStartStr)) {
          return sum + amount;
        }
        return sum;
      } else if (inc.frequency === 'monthly') {
        return sum + (amount * 12) / 52;
      }
      return sum;
    }, 0);
  }, [income, weekStartStr, incomeOverrides]);

  // Calculate total quick expenses
  const totalQuickExpenses = useMemo(() => {
    return quickExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [quickExpenses]);

  // Filter expenses for this week (matching WeeklyView logic)
  const weeklyExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (!expense.is_active) return false;

      if (expense.frequency === 'weekly') {
        return true;
      } else if (expense.frequency === 'biweekly') {
        // Use start_date to determine which weeks the expense applies
        return isBiweeklyWeek(expense.start_date, weekStartStr);
      } else if (expense.due_day) {
        // Check if effective due_day falls within this week (handles 31st in shorter months)
        return weekDays.some(day => {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, day);
          return day.getDate() === effectiveDueDay;
        });
      }
      return false;
    });
  }, [expenses, weekDays, weekStartStr]);

  const summaries = useMemo(() => {
    const result = {};
    for (const category of Object.keys(categoryConfig)) {
      const categoryExpenses = weeklyExpenses.filter(e => e.category === category);
      result[category] = {
        count: categoryExpenses.length,
        total: categoryExpenses.reduce((sum, e) => sum + getActualExpense(e), 0),
        expenses: categoryExpenses.sort((a, b) => (a.due_day || 0) - (b.due_day || 0)),
      };
    }
    return result;
  }, [weeklyExpenses, expenseOverrides]);

  const toggleCategory = (category) => {
    setExpandedCategory(prev => prev === category ? null : category);
  };

  const frequencyLabels = {
    'one-time': 'One-time',
    'weekly': 'Weekly',
    'biweekly': 'Biweekly',
    'monthly': 'Monthly',
  };

  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const totalExpenses = Object.values(summaries).reduce((sum, s) => sum + s.total, 0);
  const totalAvailable = weeklyIncome + rollover;
  const discretionary = totalAvailable - totalExpenses;
  const remaining = discretionary - totalQuickExpenses;

  // Calculate NEXT week's projected budget
  const nextWeekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(nextWeekStart, i));
    }
    return days;
  }, [nextWeekStart]);

  // Next week's income (using base amounts, no overrides)
  const nextWeekIncome = useMemo(() => {
    return income.reduce((sum, inc) => {
      if (!inc.is_active) return sum;
      
      if (inc.frequency === 'weekly') {
        return sum + inc.amount;
      } else if (inc.frequency === 'biweekly') {
        if (isBiweeklyWeek(inc.start_date, nextWeekStartStr)) {
          return sum + inc.amount;
        }
        return sum;
      } else if (inc.frequency === 'monthly') {
        return sum + (inc.amount * 12) / 52;
      }
      return sum;
    }, 0);
  }, [income, nextWeekStartStr]);

  // Next week's expenses
  const nextWeekExpenses = useMemo(() => {
    return expenses.filter(expense => {
      if (!expense.is_active) return false;

      if (expense.frequency === 'weekly') {
        return true;
      } else if (expense.frequency === 'biweekly') {
        return isBiweeklyWeek(expense.start_date, nextWeekStartStr);
      } else if (expense.due_day) {
        return nextWeekDays.some(day => {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, day);
          return day.getDate() === effectiveDueDay;
        });
      }
      return false;
    });
  }, [expenses, nextWeekDays, nextWeekStartStr]);

  // Helper to get next week's actual expense amount
  const getNextWeekActualExpense = (expense) => {
    return nextWeekExpenseOverrides[expense.id] ?? expense.amount;
  };

  const nextWeekTotalExpenses = nextWeekExpenses.reduce((sum, e) => sum + getNextWeekActualExpense(e), 0);
  // Calculate next week's base remaining (income - expenses, before any rollover)
  const nextWeekBaseRemaining = nextWeekIncome - nextWeekTotalExpenses;
  // Projected remaining includes potential rollover from this week
  const nextWeekProjectedRemaining = nextWeekBaseRemaining + Math.max(remaining, 0);
  // Warn if next week's base budget is negative (expenses exceed income)
  const isNextWeekWarning = nextWeekBaseRemaining < 0;

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Budget Overview</h2>
        <div className="income-summary-cards">
          <div className="income-card">
            <span className="material-symbols-rounded">payments</span>
            <div className="income-info">
              <span className="label">Income</span>
              <span className="amount">+${Math.round(weeklyIncome).toLocaleString()}</span>
            </div>
          </div>
          {rollover > 0 && (
            <div className="income-card rollover">
              <span className="material-symbols-rounded">history</span>
              <div className="income-info">
                <span className="label">Rollover</span>
                <span className="amount">+${Math.round(rollover).toLocaleString()}</span>
              </div>
            </div>
          )}
          <div className="income-card total">
            <span className="material-symbols-rounded">account_balance</span>
            <div className="income-info">
              <span className="label">Available</span>
              <span className="amount">${Math.round(totalAvailable).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="category-cards">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const isExpanded = expandedCategory === key;
          const categoryData = summaries[key];
          
          return (
            <div 
              key={key} 
              className={`category-card ${isExpanded ? 'expanded' : ''}`} 
              style={{ '--accent': config.color }}
            >
              <div className="card-header" onClick={() => toggleCategory(key)}>
                <div className="header-left">
                  <span className="material-symbols-rounded icon">{config.icon}</span>
                  <span className="label">{config.label}</span>
                </div>
                <span className={`material-symbols-rounded expand-icon ${isExpanded ? 'rotated' : ''}`}>
                  expand_more
                </span>
              </div>
              <div className="card-body" onClick={() => toggleCategory(key)}>
                <span className="amount">-${categoryData.total.toLocaleString()}</span>
                <span className="count">{categoryData.count} items</span>
              </div>
              
              {isExpanded && categoryData.expenses.length > 0 && (
                <div className="card-details">
                  {categoryData.expenses.map(expense => {
                    const actualAmount = getActualExpense(expense);
                    const hasOverride = expense.id in expenseOverrides;
                    return (
                      <div key={expense.id} className={`expense-detail-row ${hasOverride ? 'has-override' : ''}`}>
                        <div className="expense-detail-info">
                          <span className="expense-name">{expense.name}</span>
                          <span className="expense-meta">
                            {frequencyLabels[expense.frequency]}
                            {expense.due_day && ` • ${getOrdinal(expense.due_day)}`}
                            {hasOverride && ' • Modified'}
                          </span>
                        </div>
                        <span className="expense-detail-amount">
                          {hasOverride && actualAmount !== expense.amount ? (
                            <>
                              <span className="original-amount">${expense.amount.toLocaleString()}</span>
                              <span className="arrow">→</span>
                              -${actualAmount.toLocaleString()}
                            </>
                          ) : (
                            <>-${actualAmount.toLocaleString()}</>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {isExpanded && categoryData.expenses.length === 0 && (
                <div className="card-details empty">
                  <span className="no-expenses">No {config.label.toLowerCase()} this week</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="balance-bar">
        <div className="balance-info">
          <div className="balance-item budgeted">
            <span className="label">
              <span className="color-dot budgeted"></span>
              Budgeted
            </span>
            <span className="amount">-${totalExpenses.toLocaleString()}</span>
          </div>
          <div className="balance-item quick">
            <span className="label">
              <span className="color-dot quick"></span>
              Quick Exp
            </span>
            <span className="amount">-${Math.round(totalQuickExpenses).toLocaleString()}</span>
          </div>
          <div className="balance-item remaining-highlight">
            <span className="label">
              <span className="color-dot remaining"></span>
              Remaining
            </span>
            <span className={`amount ${remaining >= 0 ? 'positive' : 'negative'}`}>
              ${Math.round(remaining).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="budget-bar-container">
          {totalAvailable > 0 && (
            <>
              <div 
                className="budget-bar-segment budgeted"
                style={{ width: `${Math.min((totalExpenses / totalAvailable) * 100, 100)}%` }}
              />
              <div 
                className="budget-bar-segment quick"
                style={{ width: `${Math.min((totalQuickExpenses / totalAvailable) * 100, 100 - (totalExpenses / totalAvailable) * 100)}%` }}
              />
              <div 
                className="budget-bar-segment remaining"
                style={{ width: `${Math.max((remaining / totalAvailable) * 100, 0)}%` }}
              />
            </>
          )}
        </div>
        <div className="bar-legend">
          <span className="legend-item">
            <span className="color-dot budgeted"></span>
            {totalAvailable > 0 ? Math.round((totalExpenses / totalAvailable) * 100) : 0}% Budgeted
          </span>
          <span className="legend-item">
            <span className="color-dot quick"></span>
            {totalAvailable > 0 ? Math.round((totalQuickExpenses / totalAvailable) * 100) : 0}% Quick
          </span>
          <span className="legend-item">
            <span className="color-dot remaining"></span>
            {totalAvailable > 0 ? Math.round((Math.max(remaining, 0) / totalAvailable) * 100) : 0}% Remaining
          </span>
        </div>
      </div>

      {/* Next Week Warning */}
      {isNextWeekWarning && (
        <div className="next-week-warning">
          <div className="warning-icon">
            <span className="material-symbols-rounded">warning</span>
          </div>
          <div className="warning-content">
            <span className="warning-title">⚠️ Heads up for next week!</span>
            <span className="warning-text">
              Next week ({format(nextWeekStart, 'MMM d')} – {format(nextWeekEnd, 'MMM d')}) has a projected <strong>${Math.abs(Math.round(nextWeekBaseRemaining)).toLocaleString()} deficit</strong>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
