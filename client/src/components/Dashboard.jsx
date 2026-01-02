import { useMemo, useState, useEffect } from 'react';
import { startOfWeek, endOfWeek, addDays, addWeeks, format, lastDayOfMonth, parse, isSameDay } from 'date-fns';
import { fetchWeeklyIncome, fetchWeeklyExpenseOverrides, fetchRollover, fetchQuickExpenses, fetchDueDayOverrides, fetchExpenseSchedule } from '../api/expenses';
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
  // Due date override state: { expense_id: due_date (YYYY-MM-DD) }
  const [dueDayOverrides, setDueDayOverrides] = useState({});
  // Expense schedule state: { expense_id: { due_date, amount, week_start } }
  const [expenseSchedule, setExpenseSchedule] = useState({});
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

  // Load expense schedule for this week (includes both scheduled and calculated expenses + quick expenses)
  useEffect(() => {
    const loadExpenseSchedule = async () => {
      try {
        const data = await fetchExpenseSchedule(weekStartStr);
        const schedule = {};
        data.forEach(item => {
          // Handle both regular expenses (with expense_id) and quick expenses (with quick_expense_id)
          const key = item.expense_id || `quick_${item.quick_expense_id}`;
          schedule[key] = {
            due_date: item.due_date,
            amount: item.amount,
            week_start: item.week_start,
            is_quick_expense: item.is_quick_expense || false,
            expense_id: item.expense_id,
            quick_expense_id: item.quick_expense_id,
            expense_name: item.expense_name,
            note: item.note || null
          };
        });
        setExpenseSchedule(schedule);
        
        // Also load old due date overrides for backwards compatibility
        try {
          const oldData = await fetchDueDayOverrides(weekStartStr);
          const overrides = {};
          oldData.forEach(item => {
            overrides[item.expense_id] = item.due_date || (item.due_day ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(item.due_day).padStart(2, '0')}` : null);
          });
          setDueDayOverrides(overrides);
        } catch (err) {
          // Ignore errors for old system
        }
      } catch (err) {
        console.error('Failed to load expense schedule:', err);
      }
    };
    loadExpenseSchedule();
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

  // Get actual expense amount (check schedule first, then overrides, then default)
  const getActualExpense = (expense) => {
    // For quick expenses, use the amount from the schedule
    if (expense.is_quick_expense && expense.quick_expense_id) {
      const scheduleKey = `quick_${expense.quick_expense_id}`;
      if (expenseSchedule[scheduleKey]) {
        return expenseSchedule[scheduleKey].amount;
      }
      return expense.amount;
    }
    
    // For regular expenses, check schedule first
    if (expenseSchedule[expense.id]?.amount !== undefined) {
      return expenseSchedule[expense.id].amount;
    }
    
    // Check old override system
    if (expenseOverrides[expense.id] !== undefined) {
      return expenseOverrides[expense.id];
    }
    
    // Use default amount
    return expense.amount;
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

  // Filter expenses for this week using the schedule table
  // This includes both regular expenses and quick expenses
  const weeklyExpenses = useMemo(() => {
    // Get all expenses from the schedule that fall within this week
    const scheduledExpenseIds = new Set();
    const scheduleEntries = Object.values(expenseSchedule);
    const quickExpenseEntries = [];
    
    // Separate regular expenses and quick expenses
    scheduleEntries.forEach(entry => {
      if (entry.expense_id) {
        scheduledExpenseIds.add(entry.expense_id);
      } else if (entry.is_quick_expense && entry.quick_expense_id) {
        // Create a virtual expense object for quick expenses
        quickExpenseEntries.push({
          id: `quick_${entry.quick_expense_id}`, // Unique ID for quick expenses
          name: entry.expense_name,
          amount: entry.amount,
          category: 'quick', // Separate category for quick expenses
          frequency: 'one-time',
          is_active: true,
          is_quick_expense: true,
          quick_expense_id: entry.quick_expense_id,
          due_date: entry.due_date,
          note: entry.note || null
        });
      }
    });
    
    // Filter expenses to only include those in the schedule
    const scheduledExpenses = expenses.filter(expense => {
      if (!expense.is_active) return false;
      return scheduledExpenseIds.has(expense.id);
    });
    
    // Also include expenses that aren't in schedule but should be (fallback for backwards compatibility)
    const fallbackExpenses = expenses.filter(expense => {
      if (!expense.is_active) return false;
      if (scheduledExpenseIds.has(expense.id)) return false; // Already included
      
      // Check old override system
      const dueDateOverride = dueDayOverrides[expense.id];
      if (dueDateOverride) {
        const overrideDate = parse(dueDateOverride, 'yyyy-MM-dd', new Date());
        return weekDays.some(day => isSameDay(day, overrideDate));
      }
      
      // Fallback to calculation
      if (expense.frequency === 'weekly') {
        return true;
      } else if (expense.frequency === 'biweekly') {
        return isBiweeklyWeek(expense.start_date, weekStartStr);
      } else if (expense.due_day) {
        return weekDays.some(day => {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, day);
          return day.getDate() === effectiveDueDay;
        });
      }
      return false;
    });
    
    // Combine all expenses: scheduled regular expenses + fallback expenses + quick expenses
    return [...scheduledExpenses, ...fallbackExpenses, ...quickExpenseEntries];
  }, [expenses, weekDays, weekStartStr, expenseSchedule, dueDayOverrides]);

  const summaries = useMemo(() => {
    const result = {};
    // Filter out quick expenses from regular categories
    const regularExpenses = weeklyExpenses.filter(e => !e.is_quick_expense);
    
    for (const category of Object.keys(categoryConfig)) {
      const categoryExpenses = regularExpenses.filter(e => e.category === category);
      result[category] = {
        count: categoryExpenses.length,
        total: categoryExpenses.reduce((sum, e) => sum + getActualExpense(e), 0),
        expenses: categoryExpenses.sort((a, b) => (a.due_day || 0) - (b.due_day || 0)),
      };
    }
    return result;
  }, [weeklyExpenses, expenseOverrides]);

  // Separate summary for quick expenses
  const quickExpensesSummary = useMemo(() => {
    const quickExpensesList = weeklyExpenses.filter(e => e.is_quick_expense);
    return {
      count: quickExpensesList.length,
      total: quickExpensesList.reduce((sum, e) => sum + getActualExpense(e), 0),
      expenses: quickExpensesList.sort((a, b) => {
        // Sort by due_date
        const dateA = a.due_date ? new Date(a.due_date) : new Date(0);
        const dateB = b.due_date ? new Date(b.due_date) : new Date(0);
        return dateA - dateB;
      }),
    };
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

  // Total expenses includes both regular expenses and quick expenses
  const totalExpenses = Object.values(summaries).reduce((sum, s) => sum + s.total, 0) + quickExpensesSummary.total;
  // Note: totalExpenses includes both regular expenses AND quick expenses (as virtual expense objects)
  const totalAvailable = weeklyIncome + rollover;
  const discretionary = totalAvailable - totalExpenses;
  // Remaining = discretionary (quick expenses are already included in totalExpenses)
  // This matches WeeklyView: remaining = (weeklyIncome + rollover) - totalExpenses
  // Where totalExpenses includes both regular and quick expenses from the schedule
  const remaining = discretionary;

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
  
  // Calculate safe to spend: remaining minus next week's deficit (if any)
  // If next week has a deficit, we need to reserve that amount
  // If next week is positive, we can spend all of this week's remaining
  const safeToSpend = Math.max(0, remaining + nextWeekBaseRemaining);

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
          <div className="income-card safe-to-spend">
            <span className="material-symbols-rounded">savings</span>
            <div className="income-info">
              <span className="label">Safe to Spend</span>
              <span className={`amount ${safeToSpend >= 0 ? 'positive' : 'negative'}`}>
                ${Math.round(safeToSpend).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="category-cards">
        {['bill', 'debt', 'living', 'savings'].map((key) => {
          const config = categoryConfig[key];
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
        
        {/* Quick Expenses Card */}
        <div 
          className={`category-card ${expandedCategory === 'quick' ? 'expanded' : ''}`} 
          style={{ '--accent': '#f59e0b' }}
        >
          <div className="card-header" onClick={() => toggleCategory('quick')}>
            <div className="header-left">
              <span className="material-symbols-rounded icon">receipt</span>
              <span className="label">Quick Expenses</span>
            </div>
            <span className={`material-symbols-rounded expand-icon ${expandedCategory === 'quick' ? 'rotated' : ''}`}>
              expand_more
            </span>
          </div>
          <div className="card-body" onClick={() => toggleCategory('quick')}>
            <span className="amount">-${quickExpensesSummary.total.toLocaleString()}</span>
            <span className="count">{quickExpensesSummary.count} items</span>
          </div>
          
          {expandedCategory === 'quick' && quickExpensesSummary.expenses.length > 0 && (
            <div className="card-details">
              {quickExpensesSummary.expenses.map(expense => {
                const actualAmount = getActualExpense(expense);
                const expenseDate = expense.due_date ? format(parse(expense.due_date, 'yyyy-MM-dd', new Date()), 'MMM d') : '';
                return (
                  <div key={expense.id} className="expense-detail-row">
                    <div className="expense-detail-info">
                      <span className="expense-name">{expense.name}</span>
                      <span className="expense-meta">
                        {expenseDate && ` • ${expenseDate}`}
                        {expense.note && ` • ${expense.note}`}
                      </span>
                    </div>
                    <span className="expense-detail-amount">
                      -${actualAmount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          {expandedCategory === 'quick' && quickExpensesSummary.expenses.length === 0 && (
            <div className="card-details empty">
              <span className="no-expenses">No quick expenses this week</span>
            </div>
          )}
        </div>
      </div>

      <div className="balance-bar">
        <div className="balance-info">
          {['bill', 'debt', 'living', 'savings'].map((key) => {
            const config = categoryConfig[key];
            const categoryData = summaries[key];
            if (categoryData.total === 0) return null;
            return (
              <div key={key} className="balance-item" style={{ '--accent': config.color }}>
                <span className="label">
                  <span className="color-dot" style={{ backgroundColor: config.color }}></span>
                  {config.label}
                </span>
                <span className="amount">-${categoryData.total.toLocaleString()}</span>
              </div>
            );
          })}
          {quickExpensesSummary.total > 0 && (
            <div className="balance-item" style={{ '--accent': '#f59e0b' }}>
              <span className="label">
                <span className="color-dot" style={{ backgroundColor: '#f59e0b' }}></span>
                Quick Expenses
              </span>
              <span className="amount">-${quickExpensesSummary.total.toLocaleString()}</span>
            </div>
          )}
          <div className="balance-item remaining-highlight">
            <span className="label">
              <span className="color-dot remaining"></span>
              Remaining
            </span>
            <span className={`amount ${remaining >= 0 ? 'positive' : 'negative'}`}>
              ${Math.round(remaining).toLocaleString()}
            </span>
          </div>
          <div className="balance-item safe-to-spend-highlight">
            <span className="label">
              <span className="material-symbols-rounded" style={{ fontSize: '1rem', verticalAlign: 'middle' }}>savings</span>
              Safe to Spend
            </span>
            <span className={`amount ${safeToSpend >= 0 ? 'positive' : 'negative'}`}>
              ${Math.round(safeToSpend).toLocaleString()}
            </span>
          </div>
        </div>
        <div className="budget-bar-container">
          {totalAvailable > 0 && (
            <>
              {['bill', 'debt', 'living', 'savings'].map((key) => {
                const config = categoryConfig[key];
                const categoryData = summaries[key];
                if (categoryData.total === 0) return null;
                const percentage = (categoryData.total / totalAvailable) * 100;
                return (
                  <div
                    key={key}
                    className="budget-bar-segment"
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                      backgroundColor: config.color
                    }}
                  />
                );
              })}
              {quickExpensesSummary.total > 0 && (
                <div
                  className="budget-bar-segment"
                  style={{
                    width: `${Math.min((quickExpensesSummary.total / totalAvailable) * 100, 100)}%`,
                    backgroundColor: '#f59e0b'
                  }}
                />
              )}
              <div
                className="budget-bar-segment remaining"
                style={{ width: `${Math.max((remaining / totalAvailable) * 100, 0)}%` }}
              />
            </>
          )}
        </div>
        <div className="bar-legend">
          {['bill', 'debt', 'living', 'savings'].map((key) => {
            const config = categoryConfig[key];
            const categoryData = summaries[key];
            if (categoryData.total === 0) return null;
            const percentage = totalAvailable > 0 ? Math.round((categoryData.total / totalAvailable) * 100) : 0;
            return (
              <span key={key} className="legend-item">
                <span className="color-dot" style={{ backgroundColor: config.color }}></span>
                {percentage}% {config.label}
              </span>
            );
          })}
          {quickExpensesSummary.total > 0 && (
            <span className="legend-item">
              <span className="color-dot" style={{ backgroundColor: '#f59e0b' }}></span>
              {totalAvailable > 0 ? Math.round((quickExpensesSummary.total / totalAvailable) * 100) : 0}% Quick Expenses
            </span>
          )}
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
