const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/communicationController');
const requireAuth = require('../middlewares/requireAuth');

// --- All communication routes require authentication ---
router.use(requireAuth);

// SMS (Celcom)
router.post('/sms/send',      ctrl.sendSms);
router.post('/sms/bulk',      ctrl.sendBulkSms);

// WhatsApp Business
router.post('/whatsapp/send', ctrl.sendWhatsApp);

// Logs
router.get('/logs',           ctrl.getMessageLogs);

// Logs
router.get('/logs',           ctrl.getMessageLogs);

module.exports = router;
