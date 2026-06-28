const logger = require('./lib/logger');
const express = require('express');
const router = express.Router();
const transactionRepository = require('../db/transactionRepository');

// Record a new transaction
router.post('/', async (req, res) => {
  try {
    const transaction = await transactionRepository.recordTransaction(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    logger.error('Error recording transaction:', error);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});

// Get transactions by merchant
router.get('/merchant/:merchantId', async (req, res) => {
  try {
    const transactions = await transactionRepository.getTransactionsByMerchant(req.params.merchantId);
    res.json(transactions);
  } catch (error) {
    logger.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;
