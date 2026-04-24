const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/mpesaController');

const requireAuth = require('../middlewares/requireAuth');

// Safaricom Daraja STK Push IPN Callback
// Register this URL in your Daraja app: https://yourdomain.com/api/mpesa/callback
router.post('/callback', ctrl.ipnCallback);

// Initiate STK Push
router.post('/stk-push', requireAuth, ctrl.initiateStkPush);

// Check STK Push Status
router.get('/stk-status/:checkoutRequestId', requireAuth, ctrl.getStkStatus);

// Staff-initiated manual payment recording
router.post('/manual', requireAuth, ctrl.recordManualPayment);

module.exports = router;
