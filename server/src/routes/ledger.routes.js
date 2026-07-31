const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/ledger.controller');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/entries', controller.listEntries);
router.get('/trial-balance', controller.getTrialBalance);
router.get('/accounts/:id/balance', controller.getAccountBalance);

module.exports = router;
