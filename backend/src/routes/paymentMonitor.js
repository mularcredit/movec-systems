const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/paymentMonitorController');

// Summary cards
router.get('/summary',              ctrl.getSummary);

// Pie chart — status distribution
router.get('/status-distribution',  ctrl.getStatusDistribution);

// Bar chart — collections by period
router.get('/collections',          ctrl.getCollections);

// Line chart — 30-day trend
router.get('/trends',               ctrl.getTrends);

// Accounts table
router.get('/accounts',             ctrl.getAccounts);

module.exports = router;
