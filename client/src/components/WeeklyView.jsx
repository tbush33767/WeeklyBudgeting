import { useMemo, useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import { fetchPaidExpenses, markExpensePaid, markExpenseUnpaid } from '../api/expenses';
import './WeeklyView.css';

const categoryConfig = {
  bill: { label: 'Bill', icon: 'receipt_long', color: 'var(--color-bill)' },
  living: { label: 'Living', icon: 'home', color: 'var(--color-living)' },
  debt: { label: 'Debt', icon: 'credit_card', color: 'var(--color-debt)' },
  savings: { label: 'Savings', icon: 'savings', color: 'var(--color-savings)' },
};

const dayNames = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

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

export default function WeeklyView({ expenses, income, selectedDate }) {
  const today = new Date();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  const [paidExpenses, setPaidExpenses] = useState(new Set());

  // Load paid expenses for this week
  useEffect(() => {
    const loadPaid = async () => {
      try {
        const paid = await fetchPaidExpenses(weekStartStr);
        setPaidExpenses(new Set(paid.map(p => p.expense_id)));
      } catch (err) {
        console.error('Failed to load paid expenses:', err);
      }
    };
    loadPaid();
  }, [weekStartStr]);

  const handleTogglePaid = async (expenseId) => {
    try {
      if (paidExpenses.has(expenseId)) {
        await markExpenseUnpaid(expenseId, weekStartStr);
        setPaidExpenses(prev => {
          const next = new Set(prev);
          next.delete(expenseId);
          return next;
        });
      } else {
        await markExpensePaid(expenseId, weekStartStr);
        setPaidExpenses(prev => new Set([...prev, expenseId]));
      }
    } catch (err) {
      console.error('Failed to toggle paid status:', err);
    }
  };

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

  // Get income that pays out this week (for display on pay day)
  const incomeThisWeek = useMemo(() => {
    return income.filter(inc => {
      if (!inc.is_active) return false;
      
      if (inc.frequency === 'weekly') {
        return true;
      } else if (inc.frequency === 'biweekly') {
        return isBiweeklyPayWeek(inc.start_date, weekStartStr);
      } else if (inc.frequency === 'monthly') {
        return true;
      }
      return false;
    });
  }, [income, weekStartStr]);

  // Group expenses by day
  const expensesByDay = useMemo(() => {
    const result = {};
    weekDays.forEach(day => {
      result[format(day, 'yyyy-MM-dd')] = [];
    });

    expenses.forEach(expense => {
      if (!expense.is_active) return;

      if (expense.frequency === 'weekly') {
        const key = format(weekStart, 'yyyy-MM-dd');
        result[key].push(expense);
      } else if (expense.frequency === 'biweekly') {
        // For biweekly expenses, show every other week (simplified - could add start_date to expenses too)
        const startOfYear = new Date(selectedDate.getFullYear(), 0, 1);
        const weekNum = Math.floor((weekStart.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weekNum % 2 === 0) {
          const key = format(weekStart, 'yyyy-MM-dd');
          result[key].push(expense);
        }
      } else if (expense.due_day) {
        weekDays.forEach(day => {
          if (day.getDate() === expense.due_day) {
            const key = format(day, 'yyyy-MM-dd');
            result[key].push(expense);
          }
        });
      }
    });

    return result;
  }, [expenses, weekDays, weekStart, selectedDate]);

  const allWeekExpenses = useMemo(() => {
    return Object.values(expensesByDay).flat();
  }, [expensesByDay]);

  const totalThisWeek = useMemo(() => {
    return allWeekExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [allWeekExpenses]);

  const totalPaid = useMemo(() => {
    return allWeekExpenses
      .filter(e => paidExpenses.has(e.id))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [allWeekExpenses, paidExpenses]);

  const totalUnpaid = totalThisWeek - totalPaid;
  const remaining = weeklyIncome - totalThisWeek;

  return (
    <div className="weekly-view">
      <div className="weekly-header">
        <div className="week-info">
          <h2>Weekly Budget</h2>
          {weeklyIncome === 0 && (
            <p className="no-income-note">No income this week</p>
          )}
        </div>
        <div className="weekly-summary">
          <div className="summary-item income">
            <span className="label">Income</span>
            <span className="amount">${Math.round(weeklyIncome).toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="label">Paid</span>
            <span className="amount paid">-${totalPaid.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="label">Unpaid</span>
            <span className="amount expense">-${totalUnpaid.toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="label">Remaining</span>
            <span className={`amount ${remaining >= 0 ? 'positive' : 'negative'}`}>
              ${Math.round(remaining).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <div className="week-calendar">
        {weekDays.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayExpenses = expensesByDay[dateKey] || [];
          const dayTotal = dayExpenses.reduce((sum, e) => sum + e.amount, 0);
          const isToday = isSameDay(day, today);
          
          // Map display index to actual day of week (0=Fri, 1=Sat, 2=Sun, 3=Mon, 4=Tue, 5=Wed, 6=Thu)
          const actualDayOfWeek = (idx + 5) % 7; // Convert to standard day (0=Sun, 5=Fri, etc)
          const dayIncome = incomeThisWeek.filter(inc => inc.pay_day === actualDayOfWeek);
          const isPayday = dayIncome.length > 0;

          return (
            <div key={dateKey} className={`day-column ${isToday ? 'today' : ''} ${isPayday ? 'payday' : ''}`}>
              <div className="day-header">
                <span className="day-name">{dayNames[idx]}</span>
                <span className="day-date">{format(day, 'd')}</span>
                {isPayday && (
                  <span className="payday-badge">
                    <span className="material-symbols-rounded">payments</span>
                    Payday
                  </span>
                )}
              </div>
              <div className="day-expenses">
                {isPayday && dayIncome.map((inc, i) => (
                  <div key={`inc-${inc.id}-${i}`} className="day-income">
                    <span className="material-symbols-rounded income-icon">add_circle</span>
                    <span className="income-name">{inc.name}</span>
                    <span className="income-amount">+${inc.amount.toLocaleString()}</span>
                  </div>
                ))}
                {dayExpenses.length === 0 && !isPayday ? (
                  <span className="no-expenses">—</span>
                ) : (
                  dayExpenses.map((expense, i) => {
                    const isPaid = paidExpenses.has(expense.id);
                    return (
                      <div 
                        key={`${expense.id}-${i}`} 
                        className={`day-expense ${isPaid ? 'is-paid' : ''}`}
                        style={{ '--cat-color': categoryConfig[expense.category]?.color }}
                        onClick={() => handleTogglePaid(expense.id)}
                      >
                        <button className={`paid-checkbox ${isPaid ? 'checked' : ''}`}>
                          <span className="material-symbols-rounded">
                            {isPaid ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                        </button>
                        <span className="expense-name">{expense.name}</span>
                        <span className="expense-amount">-${expense.amount}</span>
                        <div className="expense-tooltip">
                          <strong>{expense.name}</strong>
                          <span>${expense.amount.toLocaleString()}</span>
                          <span className="tooltip-meta">{categoryConfig[expense.category]?.label} • {isPaid ? 'Paid' : 'Unpaid'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {(dayExpenses.length > 0 || isPayday) && (
                <div className="day-total">
                  {isPayday && <span className="day-income-total">+${dayIncome.reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>}
                  {dayExpenses.length > 0 && <span className="day-expense-total">-${dayTotal.toLocaleString()}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
