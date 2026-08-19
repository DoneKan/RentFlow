const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/team.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const INVITE_MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const updateSchema = Joi.object({
  role: Joi.string().valid(...controller.ASSIGNABLE_ROLES),
  isActive: Joi.boolean(),
}).min(1);

router.use(authenticate, authorize(...INVITE_MANAGER_ROLES));

router.get('/', controller.list);
router.put('/:id', validate(updateSchema), controller.update);

module.exports = router;
