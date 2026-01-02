import { useMemo, useState, useEffect, useRef } from 'react';
import { format, startOfWeek, endOfWeek, addDays, isSameDay, lastDayOfMonth, parse } from 'date-fns';
import { fetchPaidExpenses, addPayment, clearExpensePayments, deletePayment, updatePaymentDate, fetchRollover, updateRollover, fetchWeeklyIncome, updateWeeklyIncome, resetWeeklyIncome, fetchWeeklyExpenseOverrides, updateWeeklyExpense, resetWeeklyExpense, fetchQuickExpenses, addQuickExpense, deleteQuickExpense, fetchActualBalance, updateActualBalance, fetchDueDayOverrides, updateDueDayOverride, deleteDueDayOverride, fetchExpenseSchedule, updateExpenseSchedule, deleteExpenseSchedule } from '../api/expenses';
import './WeeklyView.css';

const categoryConfig = {
  bill: { label: 'Bill', icon: 'receipt_long', color: 'var(--color-bill)' },
  living: { label: 'Living', icon: 'home', color: 'var(--color-living)' },
  debt: { label: 'Debt', icon: 'credit_card', color: 'var(--color-debt)' },
  savings: { label: 'Savings', icon: 'savings', color: 'var(--color-savings)' },
};

const dayNames = ['Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

// Helper to get ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = (n) => {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
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

export default function WeeklyView({ expenses, income, selectedDate }) {
  const today = new Date();
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 5 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');

  // Track paid amounts per expense: { expense_id: total_paid }
  const [paidAmounts, setPaidAmounts] = useState({});
  // Track individual payments: { expense_id: [payment objects] }
  const [payments, setPayments] = useState({});
  // Payment modal state
  const [paymentModal, setPaymentModal] = useState(null); // { expense, remaining }
  const [paymentAmount, setPaymentAmount] = useState('');
  const paymentInputRef = useRef(null);
  // Payment date editing state: { paymentId: { editing: true, date: '...' } }
  const [editingPaymentDates, setEditingPaymentDates] = useState({});
  
  // Rollover state
  const [rollover, setRollover] = useState(0);
  const [editingRollover, setEditingRollover] = useState(false);
  const [rolloverInput, setRolloverInput] = useState('');
  const rolloverInputRef = useRef(null);

  // Income override state: { income_id: { actual_amount, received } }
  const [incomeOverrides, setIncomeOverrides] = useState({});
  // Income modal state
  const [incomeModal, setIncomeModal] = useState(null); // { income, actualAmount }
  const [incomeAmount, setIncomeAmount] = useState('');
  const incomeInputRef = useRef(null);

  // Expense override state: { expense_id: actual_amount }
  const [expenseOverrides, setExpenseOverrides] = useState({});
  // Due date override state: { expense_id: due_date (YYYY-MM-DD) }
  const [dueDayOverrides, setDueDayOverrides] = useState({}); // Keep for backwards compatibility
  const [expenseSchedule, setExpenseSchedule] = useState({}); // { expense_id: { due_date, amount, week_start } }
  // Expense override modal state
  const [expenseModal, setExpenseModal] = useState(null); // { expense, actualAmount }
  const [expenseAmountInput, setExpenseAmountInput] = useState('');
  const expenseAmountInputRef = useRef(null);
  const [dueDateInput, setDueDateInput] = useState('');
  // Payment input for expense modal
  const [expenseModalPaymentAmount, setExpenseModalPaymentAmount] = useState('');
  const [expenseModalPaymentDate, setExpenseModalPaymentDate] = useState('');
  const expenseModalPaymentInputRef = useRef(null);

  // Quick expenses state
  const [quickExpenses, setQuickExpenses] = useState([]);
  const [quickExpenseModal, setQuickExpenseModal] = useState(false);
  const [quickExpenseName, setQuickExpenseName] = useState('');
  const [quickExpenseAmount, setQuickExpenseAmount] = useState('');
  const quickExpenseInputRef = useRef(null);

  // Actual balance state
  const [actualBalance, setActualBalance] = useState(null);
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const balanceInputRef = useRef(null);

  // Load paid expenses for this week
  useEffect(() => {
    const loadPaid = async () => {
      try {
        const data = await fetchPaidExpenses(weekStartStr);
        // Convert totals array to object
        const amounts = {};
        data.totals.forEach(t => {
          amounts[t.expense_id] = t.total_paid;
        });
        setPaidAmounts(amounts);
        
        // Store individual payments grouped by expense_id
        const paymentsByExpense = {};
        data.payments.forEach(payment => {
          if (!paymentsByExpense[payment.expense_id]) {
            paymentsByExpense[payment.expense_id] = [];
          }
          paymentsByExpense[payment.expense_id].push(payment);
        });
        setPayments(paymentsByExpense);
      } catch (err) {
        console.error('Failed to load paid expenses:', err);
      }
    };
    loadPaid();
  }, [weekStartStr]);

  // Load rollover for this week
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

  // Load weekly income overrides
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

  // Load weekly expense overrides
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

  // Load expense schedule for this week (includes both scheduled and calculated)
  useEffect(() => {
    const loadExpenseSchedule = async () => {
      try {
        const data = await fetchExpenseSchedule(weekStartStr);
        const schedule = {};
        data.forEach(item => {
          // Handle both regular expenses (with expense_id) and quick expenses (with quick_expense_id)
          const key = item.expense_id ? item.expense_id : `quick_${item.quick_expense_id}`;
          schedule[key] = {
            due_date: item.due_date,
            amount: item.amount,
            week_start: item.week_start,
            is_calculated: item.is_calculated || false,
            is_quick_expense: item.is_quick_expense || false,
            expense_id: item.expense_id,
            quick_expense_id: item.quick_expense_id,
            expense_name: item.expense_name
          };
        });
        setExpenseSchedule(schedule);
        
        // Crosscheck: Verify schedule matches what should be displayed
        try {
          const crosscheck = await fetch(`${import.meta.env.VITE_API_PORT ? `http://${window.location.hostname}:${import.meta.env.VITE_API_PORT}` : 'http://localhost:3001'}/api/schedule/crosscheck/${weekStartStr}`);
          if (crosscheck.ok) {
            const checkData = await crosscheck.json();
            if (checkData.summary.missingInSchedule > 0 || checkData.summary.extraInSchedule > 0 || checkData.summary.mismatched > 0) {
              console.warn('⚠️ Schedule crosscheck found discrepancies:', checkData.summary);
              console.warn('Details:', checkData.details);
            } else {
              console.log('✅ Schedule crosscheck passed - all entries match');
            }
          }
        } catch (err) {
          // Ignore crosscheck errors (endpoint might not be available)
          console.log('Note: Could not run schedule crosscheck:', err.message);
        }
        
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

  // Load quick expenses for this week
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

  // Load actual balance for this week
  useEffect(() => {
    const loadActualBalance = async () => {
      try {
        const data = await fetchActualBalance(weekStartStr);
        setActualBalance(data.actual_balance);
      } catch (err) {
        console.error('Failed to load actual balance:', err);
      }
    };
    loadActualBalance();
  }, [weekStartStr]);

  // Focus rollover input when editing
  useEffect(() => {
    if (editingRollover && rolloverInputRef.current) {
      rolloverInputRef.current.focus();
      rolloverInputRef.current.select();
    }
  }, [editingRollover]);

  const handleRolloverClick = () => {
    setRolloverInput(rollover.toString());
    setEditingRollover(true);
  };

  const handleRolloverSave = async () => {
    const amount = parseFloat(rolloverInput) || 0;
    try {
      await updateRollover(weekStartStr, amount);
      setRollover(amount);
      setEditingRollover(false);
    } catch (err) {
      console.error('Failed to update rollover:', err);
    }
  };

  const handleRolloverKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRolloverSave();
    } else if (e.key === 'Escape') {
      setEditingRollover(false);
    }
  };

  // Focus input when modal opens
  useEffect(() => {
    if (paymentModal && paymentInputRef.current) {
      paymentInputRef.current.focus();
      paymentInputRef.current.select();
    }
  }, [paymentModal]);

  // Focus income input when modal opens
  useEffect(() => {
    if (incomeModal && incomeInputRef.current) {
      incomeInputRef.current.focus();
      incomeInputRef.current.select();
    }
  }, [incomeModal]);

  const handleIncomeClick = (inc) => {
    const override = incomeOverrides[inc.id];
    const actualAmount = override ? override.actual_amount : inc.amount;
    setIncomeAmount(actualAmount.toString());
    setIncomeModal({ income: inc, hasOverride: !!override });
  };

  const handleIncomeSave = async () => {
    if (!incomeModal) return;
    const amount = parseFloat(incomeAmount);
    if (isNaN(amount) || amount < 0) return;

    try {
      await updateWeeklyIncome(incomeModal.income.id, weekStartStr, amount, true);
      setIncomeOverrides(prev => ({
        ...prev,
        [incomeModal.income.id]: { actual_amount: amount, received: 1 }
      }));
      setIncomeModal(null);
      setIncomeAmount('');
    } catch (err) {
      console.error('Failed to update income:', err);
    }
  };

  const handleIncomeReset = async () => {
    if (!incomeModal) return;
    try {
      await resetWeeklyIncome(incomeModal.income.id, weekStartStr);
      setIncomeOverrides(prev => {
        const next = { ...prev };
        delete next[incomeModal.income.id];
        return next;
      });
      setIncomeModal(null);
      setIncomeAmount('');
    } catch (err) {
      console.error('Failed to reset income:', err);
    }
  };

  // Expense override modal handlers
  useEffect(() => {
    if (expenseModal && expenseAmountInputRef.current) {
      expenseAmountInputRef.current.focus();
      expenseAmountInputRef.current.select();
    }
  }, [expenseModal]);

  const handleExpenseAmountClick = (expense, e) => {
    e.stopPropagation(); // Prevent triggering payment modal
    
    // Get amount - check schedule first, then overrides, then default
    const scheduled = expenseSchedule[expense.id];
    const actualAmount = scheduled?.amount ?? expenseOverrides[expense.id] ?? expense.amount;
    const paid = paidAmounts[expense.id] || 0;
    
    // Check if expense is scheduled for this week
    let scheduledDate = null;
    let overrideApplies = false;
    
    if (scheduled) {
      const scheduledDateObj = parse(scheduled.due_date, 'yyyy-MM-dd', new Date());
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 5 });
      
      // Check if scheduled date falls within this week
      if (scheduledDateObj >= weekStart && scheduledDateObj <= weekEnd) {
        scheduledDate = scheduled.due_date;
        overrideApplies = true;
      }
    }
    
    // Fall back to old due date override system for backwards compatibility
    if (!scheduledDate) {
      const dueDateOverride = dueDayOverrides[expense.id];
      
      if (dueDateOverride) {
        const overrideDate = parse(dueDateOverride, 'yyyy-MM-dd', new Date());
        
        if (expense.frequency === 'monthly') {
          const overrideMonth = overrideDate.getMonth();
          const overrideYear = overrideDate.getFullYear();
          const weekMonth = weekStart.getMonth();
          const weekYear = weekStart.getFullYear();
          
          overrideApplies = overrideMonth === weekMonth && overrideYear === weekYear;
        } else {
          const weekEnd = endOfWeek(weekStart, { weekStartsOn: 5 });
          overrideApplies = overrideDate >= weekStart && overrideDate <= weekEnd;
        }
        
        if (overrideApplies) {
          scheduledDate = dueDateOverride;
        }
      }
    }
    
    // Calculate default date: if expense has due_day, use it for the week being viewed
    let defaultDate = '';
    if (expense.due_day && !scheduledDate) {
      const weekDate = new Date(weekStart);
      const year = weekDate.getFullYear();
      const month = weekDate.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      const day = Math.min(expense.due_day, lastDay);
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      defaultDate = `${year}-${monthStr}-${dayStr}`;
    }
    
    setExpenseAmountInput(actualAmount.toString());
    setDueDateInput(scheduledDate || defaultDate);
    setExpenseModal({ 
      expense, 
      hasOverride: expense.id in expenseOverrides || scheduled?.amount !== undefined,
      hasDueDayOverride: overrideApplies,
      paid,
      actualAmount
    });
  };

  const handleExpenseAmountSave = async () => {
    if (!expenseModal) return;
    const amount = parseFloat(expenseAmountInput);
    if (isNaN(amount) || amount < 0) return;

    try {
      await updateWeeklyExpense(expenseModal.expense.id, weekStartStr, amount);
      setExpenseOverrides(prev => ({
        ...prev,
        [expenseModal.expense.id]: amount
      }));
      setExpenseModal(null);
      setExpenseAmountInput('');
    } catch (err) {
      console.error('Failed to update expense:', err);
    }
  };

  const handleExpenseAmountReset = async () => {
    if (!expenseModal) return;
    try {
      await resetWeeklyExpense(expenseModal.expense.id, weekStartStr);
      setExpenseOverrides(prev => {
        const next = { ...prev };
        delete next[expenseModal.expense.id];
        return next;
      });
      setExpenseModal(null);
      setExpenseAmountInput('');
    } catch (err) {
      console.error('Failed to reset expense:', err);
    }
  };

  const handleDueDaySave = async () => {
    if (!expenseModal) return;
    
    if (!dueDateInput || dueDateInput.trim() === '') {
      alert('Please select a due date');
      return;
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dueDateInput)) {
      alert('Invalid date format. Please use YYYY-MM-DD format.');
      return;
    }

    try {
      // Calculate the week_start that matches the due_date's week
      const dueDate = parse(dueDateInput, 'yyyy-MM-dd', new Date());
      const dueDateWeekStart = startOfWeek(dueDate, { weekStartsOn: 5 });
      const dueDateWeekStartStr = format(dueDateWeekStart, 'yyyy-MM-dd');
      
      // Get the amount override if it exists, otherwise use expense amount
      const amountOverride = expenseOverrides[expenseModal.expense.id];
      const amount = amountOverride !== undefined ? amountOverride : expenseModal.expense.amount;
      
      // Update the schedule
      const result = await updateExpenseSchedule(
        expenseModal.expense.id, 
        dueDateWeekStartStr, 
        dueDateInput,
        amount
      );
      
      // Update local state
      setExpenseSchedule(prev => ({
        ...prev,
        [expenseModal.expense.id]: {
          due_date: dueDateInput,
          amount: amount,
          week_start: dueDateWeekStartStr
        }
      }));
      
      // Also update old system for backwards compatibility
      setDueDayOverrides(prev => ({
        ...prev,
        [expenseModal.expense.id]: dueDateInput
      }));
      
      // Update the modal state to reflect the new due date override, but keep it open
      setExpenseModal(prev => ({
        ...prev,
        hasDueDayOverride: true
      }));
      
    } catch (err) {
      console.error('Failed to update due date:', err);
      alert(`Failed to save due date: ${err.message || 'Please try again.'}`);
    }
  };

  const handleDueDayReset = async () => {
    if (!expenseModal) return;
    try {
      // Remove from schedule
      await deleteExpenseSchedule(expenseModal.expense.id, weekStartStr);
      
      // Update local state
      setExpenseSchedule(prev => {
        const next = { ...prev };
        delete next[expenseModal.expense.id];
        return next;
      });
      
      // Also update old system for backwards compatibility
      setDueDayOverrides(prev => {
        const next = { ...prev };
        delete next[expenseModal.expense.id];
        return next;
      });
      
      // Reset to default date based on expense's due_day
      let defaultDate = '';
      if (expenseModal.expense.due_day) {
        const weekDate = new Date(weekStart);
        const year = weekDate.getFullYear();
        const month = weekDate.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        const day = Math.min(expenseModal.expense.due_day, lastDay);
        defaultDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      setDueDateInput(defaultDate);
      setExpenseModal(prev => ({
        ...prev,
        hasDueDayOverride: false
      }));
    } catch (err) {
      console.error('Failed to reset due date:', err);
    }
  };

  // Quick expense handlers
  useEffect(() => {
    if (quickExpenseModal && quickExpenseInputRef.current) {
      quickExpenseInputRef.current.focus();
    }
  }, [quickExpenseModal]);

  const handleAddQuickExpense = async () => {
    if (!quickExpenseName || !quickExpenseAmount) return;
    const amount = parseFloat(quickExpenseAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const newExpense = await addQuickExpense(weekStartStr, quickExpenseName, amount);
      setQuickExpenses(prev => [newExpense, ...prev]);
      setQuickExpenseModal(false);
      setQuickExpenseName('');
      setQuickExpenseAmount('');
    } catch (err) {
      console.error('Failed to add quick expense:', err);
    }
  };

  const handleDeleteQuickExpense = async (id) => {
    try {
      await deleteQuickExpense(id);
      setQuickExpenses(prev => prev.filter(e => e.id !== id));
      
      // Also reload the expense schedule to reflect the deletion
      const data = await fetchExpenseSchedule(weekStartStr);
      const schedule = {};
      data.forEach(item => {
        schedule[item.expense_id] = {
          due_date: item.due_date,
          amount: item.amount,
          week_start: item.week_start,
          is_calculated: item.is_calculated || false
        };
      });
      setExpenseSchedule(schedule);
    } catch (err) {
      console.error('Failed to delete quick expense:', err);
      alert(`Failed to delete quick expense: ${err.message || 'Please try again.'}`);
    }
  };

  // Actual balance handlers
  useEffect(() => {
    if (editingBalance && balanceInputRef.current) {
      balanceInputRef.current.focus();
      balanceInputRef.current.select();
    }
  }, [editingBalance]);

  const handleBalanceClick = () => {
    setBalanceInput(actualBalance !== null ? actualBalance.toString() : '');
    setEditingBalance(true);
  };

  const handleBalanceSave = async () => {
    const balance = parseFloat(balanceInput);
    if (isNaN(balance)) {
      setEditingBalance(false);
      return;
    }
    try {
      await updateActualBalance(weekStartStr, balance);
      setActualBalance(balance);
      setEditingBalance(false);
    } catch (err) {
      console.error('Failed to update actual balance:', err);
    }
  };

  const handleBalanceKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleBalanceSave();
    } else if (e.key === 'Escape') {
      setEditingBalance(false);
    }
  };

  const handleExpenseClick = (expense) => {
    const actualAmount = getActualExpense(expense);
    const paid = paidAmounts[expense.id] || 0;
    const remaining = actualAmount - paid;
    setPaymentAmount(remaining > 0 ? remaining.toString() : '');
    setPaymentModal({ expense, paid, remaining, actualAmount });
  };

  const handleAddPayment = async () => {
    if (!paymentModal || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      const result = await addPayment(paymentModal.expense.id, weekStartStr, amount);
      setPaidAmounts(prev => ({
        ...prev,
        [paymentModal.expense.id]: (prev[paymentModal.expense.id] || 0) + amount
      }));
      // Add the new payment to the payments list
      setPayments(prev => {
        const expensePayments = prev[paymentModal.expense.id] || [];
        return {
          ...prev,
          [paymentModal.expense.id]: [...expensePayments, result]
        };
      });
      // Update modal with new paid amount
      setPaymentModal(prev => ({
        ...prev,
        paid: (prev.paid || 0) + amount,
        remaining: prev.remaining - amount
      }));
      setPaymentAmount('');
    } catch (err) {
      console.error('Failed to add payment:', err);
    }
  };

  const handleClearPayments = async () => {
    if (!paymentModal) return;
    try {
      await clearExpensePayments(paymentModal.expense.id, weekStartStr);
      setPaidAmounts(prev => {
        const next = { ...prev };
        delete next[paymentModal.expense.id];
        return next;
      });
      setPayments(prev => {
        const next = { ...prev };
        delete next[paymentModal.expense.id];
        return next;
      });
      setPaymentModal(null);
      setPaymentAmount('');
    } catch (err) {
      console.error('Failed to clear payments:', err);
    }
  };

  const handleDeletePayment = async (paymentId, expenseId) => {
    try {
      await deletePayment(paymentId);
      // Reload payments to get updated totals
      const data = await fetchPaidExpenses(weekStartStr);
      const amounts = {};
      data.totals.forEach(t => {
        amounts[t.expense_id] = t.total_paid;
      });
      setPaidAmounts(amounts);
      
      const paymentsByExpense = {};
      data.payments.forEach(payment => {
        if (!paymentsByExpense[payment.expense_id]) {
          paymentsByExpense[payment.expense_id] = [];
        }
        paymentsByExpense[payment.expense_id].push(payment);
      });
      setPayments(paymentsByExpense);
      
      // Update payment modal if it's open for this expense
      if (paymentModal && paymentModal.expense.id === expenseId) {
        const newPaid = amounts[expenseId] || 0;
        setPaymentModal(prev => ({
          ...prev,
          paid: newPaid,
          remaining: prev.actualAmount - newPaid
        }));
      }
      
      // Update expense modal if it's open for this expense
      if (expenseModal && expenseModal.expense.id === expenseId) {
        const newPaid = amounts[expenseId] || 0;
        setExpenseModal(prev => ({
          ...prev,
          paid: newPaid
        }));
      }
    } catch (err) {
      console.error('Failed to delete payment:', err);
    }
  };

  const handleStartEditPaymentDate = (paymentId, currentDate) => {
    // Extract date part (YYYY-MM-DD) from ISO string or use as-is if already in that format
    const dateStr = currentDate.includes('T') ? currentDate.split('T')[0] : currentDate;
    setEditingPaymentDates(prev => ({
      ...prev,
      [paymentId]: { editing: true, date: dateStr }
    }));
  };

  const handleCancelEditPaymentDate = (paymentId) => {
    setEditingPaymentDates(prev => {
      const next = { ...prev };
      delete next[paymentId];
      return next;
    });
  };

  const handleSavePaymentDate = async (paymentId, expenseId) => {
    const editState = editingPaymentDates[paymentId];
    if (!editState) return;
    
    try {
      // Format date as ISO string (YYYY-MM-DD)
      const dateStr = editState.date;
      const updatedPayment = await updatePaymentDate(paymentId, dateStr);
      
      // Update local state with the response from the API
      setPayments(prev => {
        const expensePayments = prev[expenseId] || [];
        return {
          ...prev,
          [expenseId]: expensePayments.map(p => 
            p.id === paymentId 
              ? updatedPayment
              : p
          )
        };
      });
      
      setEditingPaymentDates(prev => {
        const next = { ...prev };
        delete next[paymentId];
        return next;
      });
    } catch (err) {
      console.error('Failed to update payment date:', err);
    }
  };

  const handlePayFull = async () => {
    if (!paymentModal) return;
    const actualAmount = paymentModal.actualAmount;
    const remaining = actualAmount - (paidAmounts[paymentModal.expense.id] || 0);
    if (remaining <= 0) return;

    try {
      await addPayment(paymentModal.expense.id, weekStartStr, remaining);
      setPaidAmounts(prev => ({
        ...prev,
        [paymentModal.expense.id]: actualAmount
      }));
      setPaymentModal(null);
      setPaymentAmount('');
    } catch (err) {
      console.error('Failed to pay full amount:', err);
    }
  };

  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(weekStart, i));
    }
    return days;
  }, [weekStart]);

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
      if (expenseSchedule[scheduleKey]?.amount !== undefined) {
        return expenseSchedule[scheduleKey].amount;
      }
      return expense.amount;
    }
    
    // For regular expenses, check schedule for amount override
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

  // Calculate total income for this specific week
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

  // Get income that pays out this week (for display on pay day)
  const incomeThisWeek = useMemo(() => {
    return income.filter(inc => {
      if (!inc.is_active) return false;
      
      if (inc.frequency === 'weekly') {
        return true;
      } else if (inc.frequency === 'biweekly') {
        return isBiweeklyWeek(inc.start_date, weekStartStr);
      } else if (inc.frequency === 'monthly') {
        return true;
      }
      return false;
    });
  }, [income, weekStartStr]);

  // Group expenses by day using the schedule data
  const expensesByDay = useMemo(() => {
    const result = {};
    weekDays.forEach(day => {
      result[format(day, 'yyyy-MM-dd')] = [];
    });

    // Use the schedule as the source of truth
    // The schedule includes both explicitly scheduled items and calculated items
    // Note: Quick expenses are excluded from day cards and shown separately at the bottom
    Object.keys(expenseSchedule).forEach(expenseId => {
      const scheduled = expenseSchedule[expenseId];
      
      // Skip quick expenses - they're shown in their own section at the bottom
      if (scheduled.is_quick_expense && scheduled.quick_expense_id) {
        return;
      }
      
      // Handle regular expenses
      const expense = expenses.find(e => e.id === parseInt(expenseId));
      if (!expense || !expense.is_active) return;
      
      // Use the scheduled due date
      const scheduledDate = parse(scheduled.due_date, 'yyyy-MM-dd', new Date());
      weekDays.forEach(day => {
        if (isSameDay(day, scheduledDate)) {
          const key = format(day, 'yyyy-MM-dd');
          result[key].push(expense);
        }
      });
    });

    // Also include expenses that aren't in the schedule but should appear
    // (fallback for backwards compatibility with old system)
    expenses.forEach(expense => {
      if (!expense.is_active) return;
      
      // Skip if already in schedule
      if (expenseSchedule[expense.id]) return;
      
      // Check old override system
      const dueDateOverride = dueDayOverrides[expense.id];
      if (dueDateOverride) {
        const overrideDate = parse(dueDateOverride, 'yyyy-MM-dd', new Date());
        weekDays.forEach(day => {
          if (isSameDay(day, overrideDate)) {
            const key = format(day, 'yyyy-MM-dd');
            // Only add if not already added
            if (!result[key].find(e => e.id === expense.id)) {
              result[key].push(expense);
            }
          }
        });
        return;
      }
      
      // Fallback to calculation for expenses not in schedule
      if (expense.frequency === 'weekly') {
        const key = format(weekStart, 'yyyy-MM-dd');
        if (!result[key].find(e => e.id === expense.id)) {
          result[key].push(expense);
        }
      } else if (expense.frequency === 'biweekly') {
        if (isBiweeklyWeek(expense.start_date, weekStartStr)) {
          const key = format(weekStart, 'yyyy-MM-dd');
          if (!result[key].find(e => e.id === expense.id)) {
            result[key].push(expense);
          }
        }
      } else if (expense.due_day) {
        weekDays.forEach(day => {
          const effectiveDueDay = getEffectiveDueDay(expense.due_day, day);
          if (day.getDate() === effectiveDueDay) {
            const key = format(day, 'yyyy-MM-dd');
            if (!result[key].find(e => e.id === expense.id)) {
              result[key].push(expense);
            }
          }
        });
      }
    });

    return result;
  }, [expenses, weekDays, weekStart, weekStartStr, expenseSchedule, dueDayOverrides]);

  const allWeekExpenses = useMemo(() => {
    return Object.values(expensesByDay).flat();
  }, [expensesByDay]);

  const totalThisWeek = useMemo(() => {
    // Calculate from regular expenses (excludes quick expenses from day cards)
    const regularTotal = allWeekExpenses.reduce((sum, e) => sum + getActualExpense(e), 0);
    // Add quick expenses from schedule (they're shown separately at the bottom)
    const quickTotal = quickExpenses.reduce((sum, e) => {
      const scheduleKey = `quick_${e.id}`;
      const scheduleEntry = expenseSchedule[scheduleKey];
      return sum + (scheduleEntry?.amount || e.amount);
    }, 0);
    return regularTotal + quickTotal;
  }, [allWeekExpenses, expenseOverrides, quickExpenses, expenseSchedule]);

  const totalPaid = useMemo(() => {
    return allWeekExpenses.reduce((sum, e) => {
      const actualAmount = getActualExpense(e);
      const paid = paidAmounts[e.id] || 0;
      return sum + Math.min(paid, actualAmount); // Cap paid at actual amount
    }, 0);
  }, [allWeekExpenses, paidAmounts, expenseOverrides]);

  // Calculate total quick expenses (for display purposes, but they're already in totalThisWeek)
  // Note: Quick expenses are now included in totalThisWeek via the schedule, so this is just for the separate display
  const totalQuickExpenses = useMemo(() => {
    return quickExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [quickExpenses]);

  const totalUnpaid = totalThisWeek - totalPaid;
  const totalAvailable = weeklyIncome + rollover;
  // Discretionary = what's left after budgeted expenses (available for free spending)
  // Note: totalThisWeek now includes both regular expenses and quick expenses from the schedule
  const discretionary = totalAvailable - totalThisWeek;
  // Remaining = discretionary (quick expenses are already included in totalThisWeek)
  // This matches the Dashboard calculation: remaining = (weeklyIncome + rollover - totalExpenses - totalQuickExpenses)
  // But since totalThisWeek includes quick expenses, we just use discretionary
  const remaining = discretionary;
  
  // Calculate current account balance based on:
  // Starting balance (rollover) + Income - Paid Expenses - Quick Expenses
  const calculatedBalance = rollover + weeklyIncome - totalPaid - totalQuickExpenses;
  
  // Untracked = spending not logged (if positive, you spent more than tracked)
  const untracked = actualBalance !== null ? remaining - actualBalance : null;

  return (
    <div className="weekly-view">
      <div className="weekly-header">
        <div className="week-info">
          <h2>Weekly Budget</h2>
          {weeklyIncome === 0 && (
            <p className="no-income-note">No income this week</p>
          )}
        </div>
        <div className="budget-breakdown">
          {/* Section 1: Money In */}
          <div className="budget-section money-in">
            <div className="section-header">
              <span className="material-symbols-rounded">add_circle</span>
              <span>Money In</span>
            </div>
            <div className="budget-row">
              <span className="row-label">Income</span>
              <span className="row-amount positive">+${Math.round(weeklyIncome).toLocaleString()}</span>
            </div>
            <div className="budget-row clickable" onClick={handleRolloverClick}>
              <span className="row-label">
                Rollover
                <span className="material-symbols-rounded edit-icon">edit</span>
              </span>
              {editingRollover ? (
                <div className="inline-input" onClick={e => e.stopPropagation()}>
                  <span className="currency-symbol">$</span>
                  <input
                    ref={rolloverInputRef}
                    type="number"
                    value={rolloverInput}
                    onChange={e => setRolloverInput(e.target.value)}
                    onKeyDown={handleRolloverKeyDown}
                    onBlur={handleRolloverSave}
                    step="0.01"
                  />
                </div>
              ) : (
                <span className="row-amount positive">+${Math.round(rollover).toLocaleString()}</span>
              )}
            </div>
            <div className="budget-row total">
              <span className="row-label">Total Available</span>
              <span className="row-amount">${Math.round(totalAvailable).toLocaleString()}</span>
            </div>
          </div>

          {/* Section 2: Budgeted Expenses */}
          <div className="budget-section money-out">
            <div className="section-header">
              <span className="material-symbols-rounded">remove_circle</span>
              <span>Budgeted Bills</span>
            </div>
            <div className="budget-row">
              <span className="row-label">
                Paid
                <span className="row-hint">{totalPaid > 0 ? '✓' : ''}</span>
              </span>
              <span className="row-amount negative">-${Math.round(totalPaid).toLocaleString()}</span>
            </div>
            <div className="budget-row">
              <span className="row-label">Unpaid</span>
              <span className="row-amount negative">-${Math.round(totalUnpaid).toLocaleString()}</span>
            </div>
            <div className="budget-row subtotal">
              <span className="row-label">Total Bills</span>
              <span className="row-amount">-${Math.round(totalThisWeek).toLocaleString()}</span>
            </div>
          </div>

          {/* Section 3: Discretionary */}
          <div className="budget-section discretionary">
            <div className="section-header">
              <span className="material-symbols-rounded">account_balance_wallet</span>
              <span>Free Money</span>
            </div>
            <div className="budget-row result">
              <span className="row-label">After Bills</span>
              <span className={`row-amount ${discretionary >= 0 ? 'positive' : 'negative'}`}>
                ${Math.round(discretionary).toLocaleString()}
              </span>
            </div>
            <div className="budget-row clickable" onClick={() => setQuickExpenseModal(true)}>
              <span className="row-label">
                Quick Expenses
                <span className="material-symbols-rounded edit-icon">add</span>
              </span>
              <span className="row-amount negative">-${Math.round(totalQuickExpenses).toLocaleString()}</span>
            </div>
            <div className="budget-row remaining-row">
              <span className="row-label">
                <span className="material-symbols-rounded">savings</span>
                Remaining
              </span>
              <span className={`row-amount big ${remaining >= 0 ? 'positive' : 'negative'}`}>
                ${Math.round(remaining).toLocaleString()}
              </span>
            </div>
            <p className="remaining-hint">This is what you can spend freely or save for next week</p>
          </div>

          {/* Section 4: Reality Check */}
          <div className="budget-section reality-check">
            <div className="section-header">
              <span className="material-symbols-rounded">fact_check</span>
              <span>Reality Check</span>
            </div>
            <div className="budget-row">
              <span className="row-label">
                <span className="material-symbols-rounded">calculate</span>
                Calculated Balance
              </span>
              <span className={`row-amount ${calculatedBalance >= 0 ? 'positive' : 'negative'}`}>
                ${Math.round(calculatedBalance).toLocaleString()}
              </span>
            </div>
            <div className="budget-row clickable" onClick={handleBalanceClick}>
              <span className="row-label">
                Actual Balance
                <span className="material-symbols-rounded edit-icon">edit</span>
              </span>
              {editingBalance ? (
                <div className="inline-input" onClick={e => e.stopPropagation()}>
                  <span className="currency-symbol">$</span>
                  <input
                    ref={balanceInputRef}
                    type="number"
                    value={balanceInput}
                    onChange={e => setBalanceInput(e.target.value)}
                    onKeyDown={handleBalanceKeyDown}
                    onBlur={handleBalanceSave}
                    step="0.01"
                  />
                </div>
              ) : (
                <span className="row-amount">
                  {actualBalance !== null ? `$${Math.round(actualBalance).toLocaleString()}` : '—'}
                </span>
              )}
            </div>
            {untracked !== null && untracked !== 0 && (
              <div className={`budget-row untracked ${untracked > 0 ? 'warning' : 'bonus'}`}>
                <span className="row-label">
                  <span className="material-symbols-rounded">
                    {untracked > 0 ? 'warning' : 'celebration'}
                  </span>
                  {untracked > 0 ? 'Untracked Spending' : 'Extra Found'}
                </span>
                <span className={`row-amount ${untracked > 0 ? 'negative' : 'positive'}`}>
                  {untracked > 0 ? '-' : '+'}${Math.abs(Math.round(untracked)).toLocaleString()}
            </span>
              </div>
            )}
            {actualBalance === null && (
              <p className="actual-hint">Enter your bank balance to see if anything is untracked</p>
            )}
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
                {isPayday && dayIncome.map((inc, i) => {
                  const actualAmount = getActualIncome(inc);
                  const hasOverride = !!incomeOverrides[inc.id];
                  const isDifferent = hasOverride && actualAmount !== inc.amount;
                  return (
                    <div 
                      key={`inc-${inc.id}-${i}`} 
                      className={`day-income clickable ${hasOverride ? 'has-override' : ''}`}
                      onClick={() => handleIncomeClick(inc)}
                    >
                      <span className="material-symbols-rounded income-icon">
                        {hasOverride ? 'check_circle' : 'add_circle'}
                      </span>
                    <span className="income-name">{inc.name}</span>
                      <span className="income-amount">
                        {isDifferent ? (
                          <><span className="original-amount">${inc.amount.toLocaleString()}</span> → +${actualAmount.toLocaleString()}</>
                        ) : (
                          <>+${actualAmount.toLocaleString()}</>
                        )}
                      </span>
                  </div>
                  );
                })}
                {dayExpenses.length === 0 && !isPayday ? (
                  <span className="no-expenses">—</span>
                ) : (
                  dayExpenses.map((expense, i) => {
                    const actualAmount = getActualExpense(expense);
                    const hasOverride = expense.id in expenseOverrides;
                    const isDifferent = hasOverride && actualAmount !== expense.amount;
                    const paidAmount = paidAmounts[expense.id] || 0;
                    const isPaid = paidAmount >= actualAmount;
                    const isPartial = paidAmount > 0 && paidAmount < actualAmount;
                    const percentPaid = Math.min(100, (paidAmount / actualAmount) * 100);
                    return (
                      <div 
                        key={`${expense.id}-${i}`} 
                        className={`day-expense ${isPaid ? 'is-paid' : ''} ${isPartial ? 'is-partial' : ''} ${hasOverride ? 'has-override' : ''}`}
                        style={{ '--cat-color': categoryConfig[expense.category]?.color, '--percent-paid': `${percentPaid}%` }}
                        onClick={() => handleExpenseClick(expense)}
                      >
                        <button className={`paid-checkbox ${isPaid ? 'checked' : ''} ${isPartial ? 'partial' : ''}`}>
                          <span className="material-symbols-rounded">
                            {isPaid ? 'check_circle' : isPartial ? 'pending' : 'radio_button_unchecked'}
                          </span>
                        </button>
                        <span className="expense-name">{expense.name}</span>
                        <span 
                          className="expense-amount clickable-amount"
                          onClick={(e) => handleExpenseAmountClick(expense, e)}
                        >
                          {isPartial ? (
                            <>${paidAmount.toLocaleString()} / ${actualAmount.toLocaleString()}</>
                          ) : isDifferent ? (
                            <><span className="original-amount">${expense.amount.toLocaleString()}</span> → -${actualAmount.toLocaleString()}</>
                          ) : (
                            <>-${actualAmount.toLocaleString()}</>
                          )}
                          <span className="material-symbols-rounded edit-amount-icon">edit</span>
                        </span>
                        <div className="expense-tooltip">
                          <strong>{expense.name}</strong>
                          <span>${actualAmount.toLocaleString()}</span>
                          {isDifferent && <span className="tooltip-modified">Modified from ${expense.amount.toLocaleString()}</span>}
                          {isPartial && <span className="tooltip-partial">Paid: ${paidAmount.toLocaleString()}</span>}
                          <span className="tooltip-meta">{categoryConfig[expense.category]?.label} • {isPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {(dayExpenses.length > 0 || isPayday) && (
                <div className="day-total">
                  {isPayday && <span className="day-income-total">+${dayIncome.reduce((s, i) => s + getActualIncome(i), 0).toLocaleString()}</span>}
                  {dayExpenses.length > 0 && <span className="day-expense-total">-${dayExpenses.reduce((s, e) => s + getActualExpense(e), 0).toLocaleString()}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Expenses Section */}
      {quickExpenses.length > 0 && (
        <div className="quick-expenses-section">
          <div className="quick-expenses-header">
            <h3>
              <span className="material-symbols-rounded">receipt</span>
              Quick Expenses
            </h3>
            <button className="btn-add-quick" onClick={() => setQuickExpenseModal(true)}>
              <span className="material-symbols-rounded">add</span>
            </button>
          </div>
          <div className="quick-expenses-list">
            {quickExpenses.map(exp => {
              // Get the due_date from the schedule if available
              const scheduleKey = `quick_${exp.id}`;
              const scheduleEntry = expenseSchedule[scheduleKey];
              const dueDate = scheduleEntry?.due_date || exp.week_start;
              const formattedDate = dueDate ? format(parse(dueDate, 'yyyy-MM-dd', new Date()), 'MMM d') : '';
              
              return (
                <div key={exp.id} className="quick-expense-item">
                  <span className="quick-expense-name">{exp.name}</span>
                  <div className="quick-expense-right">
                    <span className="quick-expense-amount">-${exp.amount.toLocaleString()}</span>
                    {formattedDate && (
                      <span className="quick-expense-date">{formattedDate}</span>
                    )}
                    <button 
                      className="quick-expense-delete"
                      onClick={() => handleDeleteQuickExpense(exp.id)}
                    >
                      <span className="material-symbols-rounded">close</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick Expense Modal */}
      {quickExpenseModal && (
        <div className="payment-modal-overlay" onClick={() => setQuickExpenseModal(false)}>
          <div className="payment-modal quick-expense-modal" onClick={e => e.stopPropagation()}>
            <div className="payment-modal-header">
              <h3>
                <span className="material-symbols-rounded">receipt</span>
                Add Quick Expense
              </h3>
              <button className="btn-close" onClick={() => setQuickExpenseModal(false)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            
            <div className="payment-modal-body">
              <div className="payment-input-group">
                <label>What did you spend on?</label>
                <input
                  ref={quickExpenseInputRef}
                  type="text"
                  className="quick-expense-name-input"
                  value={quickExpenseName}
                  onChange={e => setQuickExpenseName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddQuickExpense()}
                  placeholder="Coffee, lunch, gas, etc."
                />
              </div>

              <div className="payment-input-group">
                <label>Amount</label>
                <div className="payment-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    value={quickExpenseAmount}
                    onChange={e => setQuickExpenseAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddQuickExpense()}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="payment-actions">
                <button className="btn-secondary" onClick={() => setQuickExpenseModal(false)}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleAddQuickExpense}>
                  <span className="material-symbols-rounded">add</span>
                  Add Expense
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <div className="payment-modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="payment-modal" onClick={e => e.stopPropagation()}>
            <div className="payment-modal-header">
              <h3>
                <span className="material-symbols-rounded">payments</span>
                {paymentModal.expense.name}
              </h3>
              <button className="btn-close" onClick={() => setPaymentModal(null)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            
            <div className="payment-modal-body">
              <div className="payment-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${Math.min(100, (paymentModal.paid / paymentModal.actualAmount) * 100)}%` }}
                  />
                </div>
                <div className="progress-labels">
                  <span>Paid: ${paymentModal.paid.toLocaleString()}</span>
                  <span>Total: ${paymentModal.actualAmount.toLocaleString()}</span>
                </div>
              </div>

              {paymentModal.remaining > 0 ? (
                <>
                  <div className="payment-input-group">
                    <label>Payment Amount</label>
                    <div className="payment-input-wrapper">
                      <span className="currency-symbol">$</span>
                      <input
                        ref={paymentInputRef}
                        type="number"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddPayment()}
                        min="0"
                        max={paymentModal.remaining}
                        step="0.01"
                      />
                    </div>
                    <span className="remaining-hint">
                      Remaining: ${paymentModal.remaining.toLocaleString()}
                    </span>
                  </div>

                  <div className="payment-actions">
                    <button className="btn-secondary" onClick={handlePayFull}>
                      Pay Full (${paymentModal.remaining.toLocaleString()})
                    </button>
                    <button className="btn-primary" onClick={handleAddPayment}>
                      <span className="material-symbols-rounded">add</span>
                      Add Payment
                    </button>
                  </div>
                </>
              ) : (
                <div className="fully-paid-message">
                  <span className="material-symbols-rounded">check_circle</span>
                  Fully Paid!
                </div>
              )}

              {paymentModal.paid > 0 && (
                <button className="btn-clear" onClick={handleClearPayments}>
                  <span className="material-symbols-rounded">restart_alt</span>
                  Clear All Payments
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Income Modal */}
      {incomeModal && (
        <div className="payment-modal-overlay" onClick={() => setIncomeModal(null)}>
          <div className="payment-modal income-modal" onClick={e => e.stopPropagation()}>
            <div className="payment-modal-header">
              <h3>
                <span className="material-symbols-rounded">payments</span>
                {incomeModal.income.name}
              </h3>
              <button className="btn-close" onClick={() => setIncomeModal(null)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            
            <div className="payment-modal-body">
              <div className="income-expected">
                <span className="label">Expected Amount</span>
                <span className="expected-value">${incomeModal.income.amount.toLocaleString()}</span>
              </div>

              <div className="payment-input-group">
                <label>Actual Amount Received</label>
                <div className="payment-input-wrapper income-input">
                  <span className="currency-symbol">$</span>
                  <input
                    ref={incomeInputRef}
                    type="number"
                    value={incomeAmount}
                    onChange={e => setIncomeAmount(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleIncomeSave()}
                    min="0"
                    step="0.01"
                  />
                </div>
                <span className="remaining-hint">
                  Adjust if you received overtime, deductions, etc.
                </span>
              </div>

              <div className="payment-actions">
                <button className="btn-secondary" onClick={() => {
                  setIncomeAmount(incomeModal.income.amount.toString());
                }}>
                  Use Expected
                </button>
                <button className="btn-primary income-save" onClick={handleIncomeSave}>
                  <span className="material-symbols-rounded">check</span>
                  Save
                </button>
              </div>

              {incomeModal.hasOverride && (
                <button className="btn-clear" onClick={handleIncomeReset}>
                  <span className="material-symbols-rounded">restart_alt</span>
                  Reset to Expected
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expense Amount Override Modal */}
      {expenseModal && (
        <div className="payment-modal-overlay" onClick={() => setExpenseModal(null)}>
          <div className="payment-modal expense-amount-modal" onClick={e => e.stopPropagation()}>
            <div className="payment-modal-header">
              <h3>
                <span className="material-symbols-rounded">edit</span>
                {expenseModal.expense.name}
              </h3>
              <button className="btn-close" onClick={() => setExpenseModal(null)}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>
            
            <div className="payment-modal-body">
              <div className="income-expected">
                <span className="label">Budgeted Amount</span>
                <span className="expected-value">${expenseModal.expense.amount.toLocaleString()}</span>
              </div>

              <div className="payment-input-group">
                <label>This Week's Amount</label>
                <div className="payment-input-wrapper">
                  <span className="currency-symbol">$</span>
                  <input
                    ref={expenseAmountInputRef}
                    type="number"
                    value={expenseAmountInput}
                    onChange={e => setExpenseAmountInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleExpenseAmountSave()}
                    min="0"
                    step="0.01"
                  />
                </div>
                <span className="remaining-hint">
                  Modify if this week's bill is different (e.g., variable utilities)
                </span>
              </div>

              <div className="payment-actions">
                <button className="btn-secondary" onClick={() => {
                  setExpenseAmountInput(expenseModal.expense.amount.toString());
                }}>
                  Use Budgeted
                </button>
                <button className="btn-primary" onClick={handleExpenseAmountSave}>
                  <span className="material-symbols-rounded">check</span>
                  Save
                </button>
              </div>

              {expenseModal.hasOverride && (
                <button className="btn-clear" onClick={handleExpenseAmountReset}>
                  <span className="material-symbols-rounded">restart_alt</span>
                  Reset to Budgeted
                </button>
              )}

              {/* Due Date Override Section - only show for expenses with due_day */}
              {expenseModal.expense.due_day && (
                <>
                  <div className="payment-input-group">
                    <label>New Due Date</label>
                    <div className="payment-input-wrapper">
                      <span className="material-symbols-rounded input-icon">calendar_today</span>
                      <input
                        type="date"
                        value={dueDateInput}
                        onChange={e => setDueDateInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleDueDaySave()}
                        required
                      />
                    </div>
                    <span className="remaining-hint">
                      {expenseModal.hasDueDayOverride 
                        ? `Override active for this month only. Next month will use the default due date (${expenseModal.expense.due_day}${getOrdinalSuffix(expenseModal.expense.due_day)}).`
                        : `Normally due on the ${expenseModal.expense.due_day}${getOrdinalSuffix(expenseModal.expense.due_day)} of each month. This override will only apply to this specific month - next month will revert to the default.`}
                    </span>
                  </div>

                  <div className="payment-actions">
                    {expenseModal.hasDueDayOverride && (
                      <button className="btn-secondary" onClick={handleDueDayReset}>
                        Use Normal Due Day
                      </button>
                    )}
                    <button className="btn-primary" onClick={handleDueDaySave}>
                      <span className="material-symbols-rounded">check</span>
                      Save Due Date
                    </button>
                  </div>
                </>
              )}

              {/* Payment History Section */}
              {(payments[expenseModal.expense.id] || []).length > 0 && (
                <div className="payment-list-section">
                  <h4>Payment History</h4>
                  <div className="payment-list">
                    {(payments[expenseModal.expense.id] || []).map((payment) => {
                      const isEditing = editingPaymentDates[payment.id]?.editing;
                      const editState = editingPaymentDates[payment.id];
                      const paymentDate = new Date(payment.paid_date);
                      const dateStr = format(paymentDate, 'yyyy-MM-dd');
                      
                      return (
                        <div key={payment.id} className="payment-item">
                          <div className="payment-item-amount">
                            ${payment.amount_paid.toLocaleString()}
                          </div>
                          <div className="payment-item-date">
                            {isEditing ? (
                              <div className="date-edit-wrapper">
                                <input
                                  type="date"
                                  value={editState.date}
                                  onChange={(e) => setEditingPaymentDates(prev => ({
                                    ...prev,
                                    [payment.id]: { ...prev[payment.id], date: e.target.value }
                                  }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSavePaymentDate(payment.id, expenseModal.expense.id);
                                    } else if (e.key === 'Escape') {
                                      handleCancelEditPaymentDate(payment.id);
                                    }
                                  }}
                                  onBlur={() => handleSavePaymentDate(payment.id, expenseModal.expense.id)}
                                  autoFocus
                                />
                                <button
                                  className="btn-date-save"
                                  onClick={() => handleSavePaymentDate(payment.id, expenseModal.expense.id)}
                                >
                                  <span className="material-symbols-rounded">check</span>
                                </button>
                                <button
                                  className="btn-date-cancel"
                                  onClick={() => handleCancelEditPaymentDate(payment.id)}
                                >
                                  <span className="material-symbols-rounded">close</span>
                                </button>
                              </div>
                            ) : (
                              <div className="date-display-wrapper">
                                <span className="payment-date-text">{format(paymentDate, 'MMM d, yyyy')}</span>
                                <button
                                  className="btn-edit-date"
                                  onClick={() => handleStartEditPaymentDate(payment.id, payment.paid_date)}
                                  title="Edit date"
                                >
                                  <span className="material-symbols-rounded">edit</span>
                                </button>
                                <button
                                  className="btn-delete-payment"
                                  onClick={() => handleDeletePayment(payment.id, expenseModal.expense.id)}
                                  title="Delete payment"
                                >
                                  <span className="material-symbols-rounded">delete</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
