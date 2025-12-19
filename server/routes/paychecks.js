import { Router } from 'express';
import db from '../db/database.js';

const router = Router();

// Get paycheck settings
router.get('/', (req, res) => {
  try {
    const paycheck = db.prepare('SELECT * FROM paycheck WHERE id = 1').get();
    res.json(paycheck);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update paycheck settings
router.put('/', (req, res) => {
  try {
    const { amount, frequency, pay_day } = req.body;

    const existing = db.prepare('SELECT * FROM paycheck WHERE id = 1').get();

    const stmt = db.prepare(`
      UPDATE paycheck 
      SET amount = ?, frequency = ?, pay_day = ?
      WHERE id = 1
    `);

    stmt.run(
      amount ?? existing.amount,
      frequency ?? existing.frequency,
      pay_day ?? existing.pay_day
    );

    const updated = db.prepare('SELECT * FROM paycheck WHERE id = 1').get();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

