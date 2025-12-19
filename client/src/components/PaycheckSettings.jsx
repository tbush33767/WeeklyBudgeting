import { useState, useEffect } from 'react';
import './PaycheckSettings.css';

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

export default function PaycheckSettings({ paycheck, onUpdate, onClose }) {
  const [formData, setFormData] = useState({
    amount: '',
    frequency: 'biweekly',
    pay_day: 5,
  });

  useEffect(() => {
    if (paycheck) {
      setFormData({
        amount: paycheck.amount.toString(),
        frequency: paycheck.frequency,
        pay_day: paycheck.pay_day,
      });
    }
  }, [paycheck]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'pay_day' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate({
      ...formData,
      amount: parseFloat(formData.amount),
    });
  };

  return (
    <div className="paycheck-settings-overlay">
      <form className="paycheck-settings" onSubmit={handleSubmit}>
        <div className="form-header">
          <h3>
            <span className="material-symbols-rounded">payments</span>
            Paycheck Settings
          </h3>
          <button type="button" className="btn-close" onClick={onClose}>
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        
        <div className="form-group">
          <label htmlFor="amount">Paycheck Amount ($)</label>
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

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary">
            <span className="material-symbols-rounded">check</span>
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
