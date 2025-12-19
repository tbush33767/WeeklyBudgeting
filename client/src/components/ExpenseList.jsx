import './ExpenseList.css';

const categoryConfig = {
  bill: { label: 'Bill', icon: 'receipt_long' },
  living: { label: 'Living', icon: 'home' },
  debt: { label: 'Debt', icon: 'credit_card' },
  savings: { label: 'Savings', icon: 'savings' },
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

export default function ExpenseList({ expenses, onEdit, onDelete }) {
  if (expenses.length === 0) {
    return (
      <div className="expense-list-empty">
        <span className="material-symbols-rounded empty-icon">assignment</span>
        <p>No expenses yet. Add your first one!</p>
      </div>
    );
  }

  const groupedExpenses = expenses.reduce((acc, expense) => {
    const category = expense.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(expense);
    return acc;
  }, {});

  // Sort each category's expenses by due_day (nulls/undefined at the end)
  Object.keys(groupedExpenses).forEach(category => {
    groupedExpenses[category].sort((a, b) => {
      if (a.due_day == null && b.due_day == null) return 0;
      if (a.due_day == null) return 1;
      if (b.due_day == null) return -1;
      return a.due_day - b.due_day;
    });
  });

  return (
    <div className="expense-list">
      {Object.entries(groupedExpenses).map(([category, items]) => (
        <div key={category} className="expense-group">
          <h3 className="group-header">
            <span className="material-symbols-rounded icon">{categoryConfig[category]?.icon}</span>
            {categoryConfig[category]?.label || category}
          </h3>
          <div className="expense-items">
            {items.map(expense => (
              <div key={expense.id} className={`expense-item ${!expense.is_active ? 'inactive' : ''}`}>
                <div className="expense-info">
                  <span className="name">{expense.name}</span>
                  <div className="meta">
                    <span className="frequency">{frequencyLabels[expense.frequency]}</span>
                    {expense.due_day && (
                      <span className="due-day">{getOrdinal(expense.due_day)}</span>
                    )}
                  </div>
                </div>
                <div className="expense-amount">
                  <span className="amount">-${expense.amount.toLocaleString()}</span>
                  <div className="actions">
                    <button className="btn-icon" onClick={() => onEdit(expense)} title="Edit">
                      <span className="material-symbols-rounded">edit</span>
                    </button>
                    <button className="btn-icon delete" onClick={() => onDelete(expense.id)} title="Delete">
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
  );
}
