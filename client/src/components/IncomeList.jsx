import { useState } from 'react';
import './IncomeList.css';

import { format, parseISO } from 'date-fns';

const frequencyLabels = {
  'weekly': 'Weekly',
  'biweekly': 'Biweekly',
  'monthly': 'Monthly',
};

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function IncomeList({ income, onAdd, onEdit, onDelete }) {
  const totalMonthly = income.reduce((sum, inc) => {
    if (!inc.is_active) return sum;
    if (inc.frequency === 'weekly') return sum + (inc.amount * 52 / 12);
    if (inc.frequency === 'biweekly') return sum + (inc.amount * 26 / 12);
    return sum + inc.amount;
  }, 0);

  const totalPerPaycheck = income.reduce((sum, inc) => {
    if (!inc.is_active) return sum;
    return sum + inc.amount;
  }, 0);

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

      <div className="income-summary">
        <div className="summary-card">
          <span className="material-symbols-rounded">payments</span>
          <div className="summary-info">
            <span className="label">Per Paycheck</span>
            <span className="amount">${totalPerPaycheck.toLocaleString()}</span>
          </div>
        </div>
        <div className="summary-card">
          <span className="material-symbols-rounded">calendar_month</span>
          <div className="summary-info">
            <span className="label">Monthly Estimate</span>
            <span className="amount">${Math.round(totalMonthly).toLocaleString()}</span>
          </div>
        </div>
      </div>

      {income.length === 0 ? (
        <div className="income-empty">
          <span className="material-symbols-rounded empty-icon">account_balance_wallet</span>
          <p>No income sources yet. Add your first one!</p>
        </div>
      ) : (
        <div className="income-items">
          {income.map(inc => (
            <div key={inc.id} className={`income-item ${!inc.is_active ? 'inactive' : ''}`}>
              <div className="income-icon">
                <span className="material-symbols-rounded">payments</span>
              </div>
              <div className="income-info">
                <span className="name">{inc.name}</span>
                <div className="meta">
                  <span className="frequency">{frequencyLabels[inc.frequency]}</span>
                  <span className="pay-day">{dayLabels[inc.pay_day]}</span>
                  {inc.frequency === 'biweekly' && inc.start_date && (
                    <span className="start-date">from {format(parseISO(inc.start_date), 'MMM d')}</span>
                  )}
                </div>
              </div>
              <div className="income-amount">
                <span className="amount">${inc.amount.toLocaleString()}</span>
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
      )}
    </div>
  );
}

