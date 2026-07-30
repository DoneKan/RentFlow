const { Router } = require('express');
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

router.get('/dashboard', authenticate, controller.dashboard);
router.get('/financial/overview', authenticate, controller.financialOverview);
router.get('/financial/by-property', authenticate, controller.financialByProperty);
router.get('/property/:id', authenticate, controller.propertyReport);
router.get('/export', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.exportReport);
router.get('/subscription', authenticate, controller.subscription);

module.exports = router;
