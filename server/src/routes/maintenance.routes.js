const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/maintenance.controller');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.patch('/:id/assign', authorize(...STAFF_ROLES), ctrl.assign);
router.patch('/:id/complete', authorize(...STAFF_ROLES), ctrl.complete);
router.delete('/:id', ctrl.remove);

module.exports = router;
