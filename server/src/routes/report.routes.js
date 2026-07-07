const { Router } = require('express');
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/dashboard', authenticate, controller.dashboard);
router.get('/monthly', authenticate, controller.monthly);
router.get('/property/:id', authenticate, controller.propertyReport);
router.get('/export', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.exportReport);

module.exports = router;
