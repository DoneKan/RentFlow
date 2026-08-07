const { Router } = require('express');
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

router.get('/dashboard', authenticate, authorize(...STAFF_ROLES), controller.dashboard);
router.get('/financial/overview', authenticate, authorize(...STAFF_ROLES), controller.financialOverview);
router.get('/financial/by-property', authenticate, authorize(...STAFF_ROLES), controller.financialByProperty);
router.get('/property/:id', authenticate, authorize(...STAFF_ROLES), controller.propertyReport);
router.get('/export', authenticate, authorize(...STAFF_ROLES), controller.exportReport);
router.get('/subscription', authenticate, authorize(...STAFF_ROLES), controller.subscription);

module.exports = router;
