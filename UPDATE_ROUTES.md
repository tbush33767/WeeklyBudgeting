# Route Update Guide

All routes need to be updated from synchronous SQLite to async PostgreSQL. The pattern is:

**Before:**
```javascript
router.get('/', (req, res) => {
  const data = db.prepare('SELECT * FROM table').all();
  res.json(data);
});
```

**After:**
```javascript
router.get('/', async (req, res) => {
  const data = await db.prepare('SELECT * FROM table').all();
  res.json(data);
});
```

## Files to Update:
- ✅ expenses.js (DONE)
- ⏳ income.js
- ⏳ paid.js
- ⏳ dueDays.js
- ⏳ weeklyExpenses.js
- ⏳ weeklyIncome.js
- ⏳ quickExpenses.js
- ⏳ rollovers.js
- ⏳ balances.js
- ⏳ paychecks.js
- ⏳ backup.js

The database helper automatically converts `?` placeholders to PostgreSQL `$1, $2, etc.`, so you can keep using `?` in your queries.

