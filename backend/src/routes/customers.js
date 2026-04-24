const express = require('express');
const router = express.Router();
const controller = require('../controllers/customerController');
const requireAuth = require('../middlewares/requireAuth');

// --- All customer routes require authentication ---
router.use(requireAuth);

router.post('/create', controller.createCustomer);
router.post('/update/:id', controller.updateCustomer);
router.delete('/:id', controller.deleteCustomer);
router.get('/statement/:id', controller.getCustomerStatement);

module.exports = router;
