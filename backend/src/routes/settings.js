const express = require('express');
const router = express.Router();
const controller = require('../controllers/settingsController');
const diag = require('../controllers/diagnosticsController');
const requireAuth = require('../middlewares/requireAuth');

// --- All settings routes require authentication ---
router.use(requireAuth);

router.get('/', controller.getSettings);
router.post('/save', controller.saveSettings);
router.post('/test-mpesa', controller.testMpesa);
router.get('/diagnostics', diag.runIntegrityCheck);

module.exports = router;
