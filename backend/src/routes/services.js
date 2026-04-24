const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const requireAuth = require('../middlewares/requireAuth');

router.post('/provision', requireAuth, serviceController.provisionService);
router.post('/:id/password', requireAuth, serviceController.changeServicePassword);
router.get('/:id/logs', requireAuth, serviceController.getServiceLogs);

module.exports = router;
