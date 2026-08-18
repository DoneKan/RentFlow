const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/ledger.controller');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
// Every route in this file is read-only (no POST/PUT/DELETE at all), so
// Accountant gets the same access as operational staff.
router.use(authenticate, authorize(...STAFF_ROLES, 'ACCOUNTANT'));

router.get('/entries', controller.listEntries);
router.get('/trial-balance', controller.getTrialBalance);
router.get('/accounts/:id/balance', controller.getAccountBalance);

module.exports = router;
