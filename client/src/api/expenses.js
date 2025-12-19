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

// Paid expenses API
export async function fetchPaidExpenses(weekStart) {
  const response = await fetch(`${API_BASE}/paid/${weekStart}`);
  if (!response.ok) throw new Error('Failed to fetch paid expenses');
  return response.json();
}

export async function markExpensePaid(expenseId, weekStart) {
  const response = await fetch(`${API_BASE}/paid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expense_id: expenseId, week_start: weekStart }),
  });
  if (!response.ok) throw new Error('Failed to mark expense as paid');
  return response.json();
}

export async function markExpenseUnpaid(expenseId, weekStart) {
  const response = await fetch(`${API_BASE}/paid/${expenseId}/${weekStart}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to mark expense as unpaid');
  return response.json();
}

