const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/maintenance.controller');

router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
