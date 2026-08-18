const { Router } = require('express');
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
// Every route here is read-only, so Accountant gets the same access as
// operational staff — reviewing financials is exactly the job.
const REPORT_ROLES = [...STAFF_ROLES, 'ACCOUNTANT'];

router.get('/dashboard', authenticate, authorize(...REPORT_ROLES), controller.dashboard);
router.get('/financial/overview', authenticate, authorize(...REPORT_ROLES), controller.financialOverview);
router.get('/financial/by-property', authenticate, authorize(...REPORT_ROLES), controller.financialByProperty);
router.get('/property/:id', authenticate, authorize(...REPORT_ROLES), controller.propertyReport);
router.get('/export', authenticate, authorize(...REPORT_ROLES), controller.exportReport);
router.get('/export-full', authenticate, authorize(...REPORT_ROLES), controller.exportFullData);
router.get('/subscription', authenticate, authorize(...REPORT_ROLES), controller.subscription);

module.exports = router;
