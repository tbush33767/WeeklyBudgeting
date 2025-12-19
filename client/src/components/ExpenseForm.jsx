import { useState, useEffect } from 'react';
import './ExpenseForm.css';

const categories = [
  { value: 'bill', label: 'Bill', icon: 'receipt_long' },
  { value: 'living', label: 'Living Expense', icon: 'home' },
  { value: 'debt', label: 'Debt', icon: 'credit_card' },
  { value: 'savings', label: 'Savings', icon: 'savings' },
];

const frequencies = [
  { value: 'one-time', label: 'One-time' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
];

export default function ExpenseForm({ expense, onSubmit, onCancel }) {
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: 'bill',
    frequency: 'monthly',
    due_day: '',
    is_active: true,
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name,
        amount: expense.amount.toString(),
        category: expense.category,
        frequency: expense.frequency,
        due_day: expense.due_day?.toString() || '',
        is_active: Boolean(expense.is_active),
      });
    }
  }, [expense]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      due_day: formData.due_day ? parseInt(formData.due_day) : null,
      is_active: formData.is_active ? 1 : 0,
    });
  };

  const showDueDay = formData.frequency === 'monthly' || formData.frequency === 'one-time';

  return (
    <div className="expense-form-overlay">
      <form className="expense-form" onSubmit={handleSubmit}>
        <div className="form-header">
          <h3>{expense ? 'Edit Expense' : 'Add New Expense'}</h3>
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
            placeholder="e.g., Electric Bill"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount ($)</label>
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
          <label>Category</label>
          <div className="category-options">
            {categories.map(cat => (
              <label
                key={cat.value}
                className={`category-option ${formData.category === cat.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="category"
                  value={cat.value}
                  checked={formData.category === cat.value}
                  onChange={handleChange}
                />
                <span className="material-symbols-rounded icon">{cat.icon}</span>
                <span className="label">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="frequency">Frequency</label>
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

        {showDueDay && (
          <div className="form-group">
            <label htmlFor="due_day">Due Day of Month</label>
            <div className="input-with-icon">
              <span className="material-symbols-rounded input-icon">calendar_today</span>
              <input
                type="number"
                id="due_day"
                name="due_day"
                value={formData.due_day}
                onChange={handleChange}
                placeholder="1-31"
                min="1"
                max="31"
              />
            </div>
          </div>
        )}

        {expense && (
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
            <span className="material-symbols-rounded">{expense ? 'check' : 'add'}</span>
            {expense ? 'Update' : 'Add'} Expense
          </button>
        </div>
      </form>
    </div>
  );
}
