import { useState, useEffect, useCallback, useRef } from 'react';
import { addWeeks, subWeeks } from 'date-fns';
import Dashboard from './components/Dashboard';
import ExpenseList from './components/ExpenseList';
import ExpenseForm from './components/ExpenseForm';
import WeeklyView from './components/WeeklyView';
import WeekNavigation from './components/WeekNavigation';
import IncomeList from './components/IncomeList';
import IncomeForm from './components/IncomeForm';
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchIncome,
  createIncome,
  updateIncome,
  deleteIncome,
  exportBackup,
  importBackup,
} from './api/expenses';
import './App.css';

function App() {
  const [expenses, setExpenses] = useState([]);
  const [income, setIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [activeTab, setActiveTab] = useState('weekly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showBackupMenu, setShowBackupMenu] = useState(false);
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [expensesData, incomeData] = await Promise.all([
        fetchExpenses(),
        fetchIncome(),
      ]);
      setExpenses(expensesData);
      setIncome(incomeData);
      setError(null);
    } catch (err) {
      setError('Failed to load data. Make sure the server is running.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddExpense = async (data) => {
    try {
      await createExpense(data);
      await loadData();
      setShowExpenseForm(false);
    } catch (err) {
      console.error('Failed to add expense:', err);
    }
  };

  const handleUpdateExpense = async (data) => {
    try {
      await updateExpense(editingExpense.id, data);
      await loadData();
      setEditingExpense(null);
    } catch (err) {
      console.error('Failed to update expense:', err);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteExpense(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  const handleAddIncome = async (data) => {
    try {
      await createIncome(data);
      await loadData();
      setShowIncomeForm(false);
    } catch (err) {
      console.error('Failed to add income:', err);
    }
  };

  const handleUpdateIncome = async (data) => {
    try {
      await updateIncome(editingIncome.id, data);
      await loadData();
      setEditingIncome(null);
    } catch (err) {
      console.error('Failed to update income:', err);
    }
  };

  const handleDeleteIncome = async (id) => {
    if (!confirm('Are you sure you want to delete this income source?')) return;
    try {
      await deleteIncome(id);
      await loadData();
    } catch (err) {
      console.error('Failed to delete income:', err);
    }
  };

  const handlePrevWeek = () => setSelectedDate(prev => subWeeks(prev, 1));
  const handleNextWeek = () => setSelectedDate(prev => addWeeks(prev, 1));
  const handleToday = () => setSelectedDate(new Date());

  // Backup handlers
  const handleExportBackup = async () => {
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `budget-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowBackupMenu(false);
    } catch (err) {
      console.error('Failed to export backup:', err);
      alert('Failed to export backup. Please try again.');
    }
  };

  const handleImportBackup = () => {
    fileInputRef.current?.click();
    setShowBackupMenu(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      
      if (!backup.data) {
        alert('Invalid backup file format');
        return;
      }

      const clearExisting = confirm(
        'Do you want to replace all existing data?\n\n' +
        'Click OK to replace everything with the backup.\n' +
        'Click Cancel to merge the backup with existing data.'
      );

      const result = await importBackup(backup.data, clearExisting);
      alert(`Backup restored successfully!\n\nImported:\n` +
        `• ${result.counts.expenses} expenses\n` +
        `• ${result.counts.income} income sources\n` +
        `• ${result.counts.paid_expenses} payment records\n` +
        `• ${result.counts.quick_expenses} quick expenses`
      );
      
      await loadData();
    } catch (err) {
      console.error('Failed to import backup:', err);
      alert('Failed to import backup. Make sure the file is a valid backup JSON.');
    }
    
    // Reset the input
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loader"></div>
        <p>Loading your budget...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-error">
        <span className="material-symbols-rounded error-icon">error</span>
        <p>{error}</p>
        <button onClick={loadData}>
          <span className="material-symbols-rounded">refresh</span>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>
            <span className="material-symbols-rounded logo-icon">account_balance_wallet</span>
            Weekly Budget
          </h1>
          <div className="header-actions">
            <div className="backup-menu-container">
              <button 
                className="btn-icon-header" 
                onClick={() => setShowBackupMenu(!showBackupMenu)}
                title="Backup & Restore"
              >
                <span className="material-symbols-rounded">settings_backup_restore</span>
              </button>
              {showBackupMenu && (
                <>
                  <div className="backup-menu-overlay" onClick={() => setShowBackupMenu(false)} />
                  <div className="backup-menu">
                    <button onClick={handleExportBackup}>
                      <span className="material-symbols-rounded">download</span>
                      Export Backup
                    </button>
                    <button onClick={handleImportBackup}>
                      <span className="material-symbols-rounded">upload</span>
                      Restore from Backup
                    </button>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
            <button className="btn-add" onClick={() => setShowExpenseForm(true)}>
              <span className="material-symbols-rounded">add</span>
              Add Expense
            </button>
          </div>
        </div>
      </header>

      <nav className="app-nav">
        <button 
          className={`nav-tab ${activeTab === 'weekly' ? 'active' : ''}`}
          onClick={() => setActiveTab('weekly')}
        >
          <span className="material-symbols-rounded">calendar_view_week</span>
          This Week
        </button>
        <button 
          className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <span className="material-symbols-rounded">dashboard</span>
          Overview
        </button>
        <button 
          className={`nav-tab ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          <span className="material-symbols-rounded">list_alt</span>
          Expenses
        </button>
        <button 
          className={`nav-tab ${activeTab === 'income' ? 'active' : ''}`}
          onClick={() => setActiveTab('income')}
        >
          <span className="material-symbols-rounded">payments</span>
          Income
        </button>
      </nav>

      <main className="app-main">
        {(activeTab === 'weekly' || activeTab === 'overview') && (
          <WeekNavigation
            currentDate={selectedDate}
            onPrevWeek={handlePrevWeek}
            onNextWeek={handleNextWeek}
            onToday={handleToday}
          />
        )}
        
        {activeTab === 'weekly' && (
          <WeeklyView 
            expenses={expenses} 
            income={income}
            selectedDate={selectedDate} 
          />
        )}
        {activeTab === 'overview' && (
          <Dashboard 
            expenses={expenses} 
            income={income}
            selectedDate={selectedDate} 
          />
        )}
        {activeTab === 'expenses' && (
          <ExpenseList
            expenses={expenses}
            onEdit={setEditingExpense}
            onDelete={handleDeleteExpense}
          />
        )}
        {activeTab === 'income' && (
          <IncomeList
            income={income}
            onAdd={() => setShowIncomeForm(true)}
            onEdit={setEditingIncome}
            onDelete={handleDeleteIncome}
          />
        )}
      </main>

      {showExpenseForm && (
        <ExpenseForm
          onSubmit={handleAddExpense}
          onCancel={() => setShowExpenseForm(false)}
        />
      )}

      {editingExpense && (
        <ExpenseForm
          expense={editingExpense}
          onSubmit={handleUpdateExpense}
          onCancel={() => setEditingExpense(null)}
        />
      )}

      {showIncomeForm && (
        <IncomeForm
          onSubmit={handleAddIncome}
          onCancel={() => setShowIncomeForm(false)}
        />
      )}

      {editingIncome && (
        <IncomeForm
          income={editingIncome}
          onSubmit={handleUpdateIncome}
          onCancel={() => setEditingIncome(null)}
        />
      )}
    </div>
  );
}

export default App;
