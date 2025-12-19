const API_BASE = 'http://localhost:3001/api';

export async function fetchExpenses() {
  const response = await fetch(`${API_BASE}/expenses`);
  if (!response.ok) throw new Error('Failed to fetch expenses');
  return response.json();
}

export async function fetchWeeklyExpenses(date) {
  const response = await fetch(`${API_BASE}/expenses/weekly/${date}`);
  if (!response.ok) throw new Error('Failed to fetch weekly expenses');
  return response.json();
}

export async function createExpense(expense) {
  const response = await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  });
  if (!response.ok) throw new Error('Failed to create expense');
  return response.json();
}

export async function updateExpense(id, expense) {
  const response = await fetch(`${API_BASE}/expenses/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expense),
  });
  if (!response.ok) throw new Error('Failed to update expense');
  return response.json();
}

export async function deleteExpense(id) {
  const response = await fetch(`${API_BASE}/expenses/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete expense');
  return response.json();
}

export async function fetchPaycheck() {
  const response = await fetch(`${API_BASE}/paycheck`);
  if (!response.ok) throw new Error('Failed to fetch paycheck');
  return response.json();
}

export async function updatePaycheck(paycheck) {
  const response = await fetch(`${API_BASE}/paycheck`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paycheck),
  });
  if (!response.ok) throw new Error('Failed to update paycheck');
  return response.json();
}

// Income API
export async function fetchIncome() {
  const response = await fetch(`${API_BASE}/income`);
  if (!response.ok) throw new Error('Failed to fetch income');
  return response.json();
}

export async function createIncome(income) {
  const response = await fetch(`${API_BASE}/income`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(income),
  });
  if (!response.ok) throw new Error('Failed to create income');
  return response.json();
}

export async function updateIncome(id, income) {
  const response = await fetch(`${API_BASE}/income/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(income),
  });
  if (!response.ok) throw new Error('Failed to update income');
  return response.json();
}

export async function deleteIncome(id) {
  const response = await fetch(`${API_BASE}/income/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete income');
  return response.json();
}

// Paid expenses API (supports partial payments)
export async function fetchPaidExpenses(weekStart) {
  const response = await fetch(`${API_BASE}/paid/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch paid expenses');
  return response.json();
}

export async function addPayment(expenseId, weekStart, amountPaid) {
  const response = await fetch(`${API_BASE}/paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expense_id: expenseId, week_start: weekStart, amount_paid: amountPaid }),
  });
  if (!response.ok) throw new Error('Failed to add payment');
  return response.json();
}

export async function deletePayment(paymentId) {
  const response = await fetch(`${API_BASE}/paid/payment/${paymentId}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete payment');
  return response.json();
}

export async function clearExpensePayments(expenseId, weekStart) {
  const response = await fetch(`${API_BASE}/paid/${expenseId}/${weekStart}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to clear payments');
  return response.json();
}

// Week rollover API
export async function fetchRollover(weekStart) {
  const response = await fetch(`${API_BASE}/rollovers/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch rollover');
  return response.json();
}

export async function updateRollover(weekStart, rolloverAmount) {
  const response = await fetch(`${API_BASE}/rollovers/${weekStart}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rollover_amount: rolloverAmount }),
  });
  if (!response.ok) throw new Error('Failed to update rollover');
  return response.json();
}

// Weekly income API (track actual income received per week)
export async function fetchWeeklyIncome(weekStart) {
  const response = await fetch(`${API_BASE}/weekly-income/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch weekly income');
  return response.json();
}

export async function updateWeeklyIncome(incomeId, weekStart, actualAmount, received = true) {
  const response = await fetch(`${API_BASE}/weekly-income/${incomeId}/${weekStart}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actual_amount: actualAmount, received }),
  });
  if (!response.ok) throw new Error('Failed to update weekly income');
  return response.json();
}

export async function resetWeeklyIncome(incomeId, weekStart) {
  const response = await fetch(`${API_BASE}/weekly-income/${incomeId}/${weekStart}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to reset weekly income');
  return response.json();
}

// Weekly expense overrides API (modify single bill occurrence)
export async function fetchWeeklyExpenseOverrides(weekStart) {
  const response = await fetch(`${API_BASE}/weekly-expenses/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch weekly expense overrides');
  return response.json();
}

export async function updateWeeklyExpense(expenseId, weekStart, actualAmount) {
  const response = await fetch(`${API_BASE}/weekly-expenses/${expenseId}/${weekStart}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actual_amount: actualAmount }),
  });
  if (!response.ok) throw new Error('Failed to update weekly expense');
  return response.json();
}

export async function resetWeeklyExpense(expenseId, weekStart) {
  const response = await fetch(`${API_BASE}/weekly-expenses/${expenseId}/${weekStart}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to reset weekly expense');
  return response.json();
}

// Quick expenses API (one-off, non-budgeted expenses)
export async function fetchQuickExpenses(weekStart) {
  const response = await fetch(`${API_BASE}/quick-expenses/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch quick expenses');
  return response.json();
}

export async function addQuickExpense(weekStart, name, amount, note = null) {
  const response = await fetch(`${API_BASE}/quick-expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ week_start: weekStart, name, amount, note }),
  });
  if (!response.ok) throw new Error('Failed to add quick expense');
  return response.json();
}

export async function deleteQuickExpense(id) {
  const response = await fetch(`${API_BASE}/quick-expenses/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete quick expense');
  return response.json();
}

// Actual balance API
export async function fetchActualBalance(weekStart) {
  const response = await fetch(`${API_BASE}/balances/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch actual balance');
  return response.json();
}

export async function updateActualBalance(weekStart, balance) {
  const response = await fetch(`${API_BASE}/balances/${weekStart}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ actual_balance: balance }),
  });
  if (!response.ok) throw new Error('Failed to update actual balance');
  return response.json();
}

// Backup API
export async function exportBackup() {
  const response = await fetch(`${API_BASE}/backup/export`);
  if (!response.ok) throw new Error('Failed to export backup');
  return response.json();
}

export async function importBackup(data, clearExisting = false) {
  const response = await fetch(`${API_BASE}/backup/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, clearExisting }),
  });
  if (!response.ok) throw new Error('Failed to import backup');
  return response.json();
}

