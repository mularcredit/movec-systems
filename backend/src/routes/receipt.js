const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/receiptController');
const requireAuth = require('../middlewares/requireAuth');

// --- All receipt routes require authentication ---
router.use(requireAuth);

// Generate and download receipt
router.get('/:id/receipt', ctrl.generateReceipt);

module.exports = router;
