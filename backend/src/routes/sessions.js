const express = require('express');
const router = express.Router();
const sessionController = require('../controllers/sessionController');

// All session routes require authentication (middleware should be applied in server.js)
router.get('/live', sessionController.getLiveSessions);
router.post('/disconnect', sessionController.disconnectSession);

module.exports = router;
