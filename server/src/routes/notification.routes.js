const { Router } = require('express');
const controller = require('../controllers/notification.controller');
const { authenticate } = require('../middleware/auth');

const router = Router();

router.get('/', authenticate, controller.list);
router.put('/read-all', authenticate, controller.markAllRead);
router.put('/:id/read', authenticate, controller.markRead);
router.delete('/:id', authenticate, controller.remove);

module.exports = router;
