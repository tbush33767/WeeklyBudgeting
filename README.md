# Weekly Budget App

A personal weekly budget application to track bills, living expenses, debts, and savings. View what money will be spent from your Friday paycheck each Sunday.

## Features

- **Dashboard Overview**: See all your expenses organized by category with totals
- **Weekly View**: Visual calendar showing which expenses come out of each paycheck
- **Expense Management**: Add, edit, and delete expenses with support for:
  - Categories: Bills, Living Expenses, Debts, Savings
  - Frequencies: One-time, Weekly, Biweekly, Monthly
- **Paycheck Settings**: Configure your paycheck amount and pay schedule
- **Persistent Data**: SQLite database ensures your data is never lost

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. **Install backend dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Install frontend dependencies:**
   ```bash
   cd client
   npm install
   ```

### Running the App

1. **Start the backend server (from the server directory):**
   ```bash
   cd server
   npm start
   ```
   The API will be available at http://localhost:3001

2. **Start the frontend (from the client directory, in a new terminal):**
   ```bash
   cd client
   npm run dev
   ```
   Open http://localhost:5173 in your browser

## Project Structure

```
WeeklyBudgeting/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── api/            # API utilities
│   │   ├── App.jsx         # Main app component
│   │   └── main.jsx        # Entry point
│   └── package.json
├── server/                 # Express backend
│   ├── db/
│   │   ├── database.js     # SQLite connection
│   │   ├── schema.sql      # Database schema
│   │   └── budget.db       # SQLite database (created on first run)
│   ├── routes/
│   │   ├── expenses.js     # Expense CRUD routes
│   │   └── paychecks.js    # Paycheck settings routes
│   ├── index.js            # Express server
│   └── package.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | Get all expenses |
| POST | `/api/expenses` | Create new expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |
| GET | `/api/expenses/weekly/:date` | Get expenses for a specific week |
| GET | `/api/paycheck` | Get paycheck settings |
| PUT | `/api/paycheck` | Update paycheck settings |

## Tech Stack

- **Frontend**: React 18, Vite, date-fns
- **Backend**: Node.js, Express
- **Database**: SQLite with better-sqlite3

