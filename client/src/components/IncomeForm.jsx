import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, nextFriday } from 'date-fns';
import './IncomeForm.css';

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

const days = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

// Generate upcoming Fridays for the picker
const getUpcomingFridays = () => {
  const fridays = [];
  let date = nextFriday(new Date());
  // Go back a few weeks too
  date = addDays(date, -28);
  for (let i = 0; i < 12; i++) {
    fridays.push({
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'MMM d, yyyy'),
    });
    date = addDays(date, 7);
  }
  return fridays;
};

export default function IncomeForm({ income, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    frequency: 'biweekly',
    pay_day: 5,
    start_date: '',
    is_active: true,
  });

  const upcomingFridays = getUpcomingFridays();

  useEffect(() => {
    if (income) {
      setFormData({
        name: income.name,
        amount: income.amount.toString(),
        frequency: income.frequency,
        pay_day: income.pay_day,
        start_date: income.start_date || '',
        is_active: Boolean(income.is_active),
      });
    } else {
      // Default to next Friday for new biweekly income
      const nextFri = nextFriday(new Date());
      setFormData(prev => ({
        ...prev,
        start_date: format(nextFri, 'yyyy-MM-dd'),
      }));
    }
  }, [income]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (name === 'pay_day' ? parseInt(value) : value),
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      start_date: formData.frequency === 'biweekly' ? formData.start_date : null,
      is_active: formData.is_active ? 1 : 0,
    });
  };

  return (
    <div className="income-form-overlay">
      <form className="income-form" onSubmit={handleSubmit}>
        <div className="form-header">
          <h3>
            <span className="material-symbols-rounded">payments</span>
            {income ? 'Edit Income' : 'Add Income Source'}
          </h3>
          <button type="button" className="btn-close" onClick={onCancel}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div className="form-group">
          <label htmlFor="name">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="e.g., Main Job, Side Hustle"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount per Paycheck ($)</label>
          <div className="input-with-icon">
            <span className="material-symbols-rounded input-icon">attach_money</span>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder=""
              min="0"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="frequency">Pay Frequency</label>
          <select
            id="frequency"
            name="frequency"
            value={formData.frequency}
            onChange={handleChange}
          >
            {frequencies.map(freq => (
              <option key={freq.value} value={freq.value}>
                {freq.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="pay_day">Pay Day</label>
          <select
            id="pay_day"
            name="pay_day"
            value={formData.pay_day}
            onChange={handleChange}
          >
            {days.map(day => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </div>

        {formData.frequency === 'biweekly' && (
          <div className="form-group">
            <label htmlFor="start_date">First Paycheck Date</label>
            <p className="form-hint">Select a pay date to sync the biweekly schedule</p>
            <select
              id="start_date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
            >
              {upcomingFridays.map(friday => (
                <option key={friday.value} value={friday.value}>
                  {friday.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {income && (
          <div className="form-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              <span className="checkmark"></span>
              Active
            </label>
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <span className="material-symbols-rounded">{income ? 'check' : 'add'}</span>
            {income ? 'Update' : 'Add'} Income
          </button>
        </div>
      </form>
    </div>
  );
}
