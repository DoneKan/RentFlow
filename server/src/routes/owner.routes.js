const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/owner.controller');

router.use(authenticate);

router.get('/portal/me', ctrl.getMyPortal);
router.get('/portal/properties/:id/statement', ctrl.getPropertyStatement);

module.exports = router;
