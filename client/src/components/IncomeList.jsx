import { useMemo } from 'react';
import './IncomeList.css';

import { format, parseISO } from 'date-fns';

const frequencyConfig = {
  'weekly': { label: 'Weekly', icon: 'event_repeat' },
  'biweekly': { label: 'Biweekly', icon: 'date_range' },
  'monthly': { label: 'Monthly', icon: 'calendar_month' },
};

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Convert income amount to monthly equivalent based on frequency
const getMonthlyAmount = (inc) => {
  switch (inc.frequency) {
    case 'weekly':
      return inc.amount * (52 / 12); // ~4.33x
    case 'biweekly':
      return inc.amount * (26 / 12); // ~2.17x
    case 'monthly':
      return inc.amount;
    default:
      return inc.amount;
  }
};

export default function IncomeList({ income, onAdd, onEdit, onDelete }) {
  // Calculate total monthly income (active only)
  const totalMonthly = useMemo(() => {
    return income
      .filter(inc => inc.is_active)
      .reduce((sum, inc) => sum + getMonthlyAmount(inc), 0);
  }, [income]);

  // Group income by frequency
  const groupedIncome = useMemo(() => {
    const groups = income.reduce((acc, inc) => {
      const freq = inc.frequency;
      if (!acc[freq]) acc[freq] = [];
      acc[freq].push(inc);
      return acc;
    }, {});
    
    // Sort by frequency order: weekly, biweekly, monthly
    const order = ['weekly', 'biweekly', 'monthly'];
    return order
      .filter(freq => groups[freq])
      .map(freq => [freq, groups[freq]]);
  }, [income]);

  // Calculate frequency totals (active only, converted to monthly)
  const frequencyTotals = useMemo(() => {
    return groupedIncome.reduce((acc, [freq, items]) => {
      acc[freq] = items
        .filter(inc => inc.is_active)
        .reduce((sum, inc) => sum + getMonthlyAmount(inc), 0);
      return acc;
    }, {});
  }, [groupedIncome]);

  return (
    <div className="income-list">
      <div className="income-header">
        <div className="income-title">
          <h2>Income Sources</h2>
          <p className="income-subtitle">Manage your paychecks and other income</p>
        </div>
        <button className="btn-add-income" onClick={onAdd}>
          <span className="material-symbols-rounded">add</span>
          Add Income
        </button>
      </div>

      <div className="income-total-header">
        <span className="total-label">Total Monthly Income</span>
        <span className="total-amount">+${Math.round(totalMonthly).toLocaleString()}</span>
      </div>

      {income.length === 0 ? (
        <div className="income-empty">
          <span className="material-symbols-rounded empty-icon">account_balance_wallet</span>
          <p>No income sources yet. Add your first one!</p>
        </div>
      ) : (
        <div className="income-groups">
          {groupedIncome.map(([frequency, items]) => (
            <div key={frequency} className="income-group">
              <h3 className="group-header">
                <span className="header-left">
                  <span className="material-symbols-rounded icon">{frequencyConfig[frequency]?.icon}</span>
                  {frequencyConfig[frequency]?.label || frequency}
                </span>
                <span className="frequency-total">+${Math.round(frequencyTotals[frequency]).toLocaleString()}</span>
              </h3>
        <div className="income-items">
                {items.map(inc => (
            <div key={inc.id} className={`income-item ${!inc.is_active ? 'inactive' : ''}`}>
              <div className="income-icon">
                <span className="material-symbols-rounded">payments</span>
              </div>
              <div className="income-info">
                <span className="name">{inc.name}</span>
                <div className="meta">
                  <span className="pay-day">{dayLabels[inc.pay_day]}</span>
                  {inc.frequency === 'biweekly' && inc.start_date && (
                    <span className="start-date">from {format(parseISO(inc.start_date), 'MMM d')}</span>
                  )}
                </div>
              </div>
              <div className="income-amount">
                      <span className="amount">+${inc.amount.toLocaleString()}</span>
                <div className="actions">
                  <button className="btn-icon" onClick={() => onEdit(inc)} title="Edit">
                    <span className="material-symbols-rounded">edit</span>
                  </button>
                  <button className="btn-icon delete" onClick={() => onDelete(inc.id)} title="Delete">
                    <span className="material-symbols-rounded">delete</span>
                  </button>
                </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

