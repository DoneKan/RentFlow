const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/account.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'];

const createSchema = Joi.object({
  code: Joi.string().uppercase().required(),
  name: Joi.string().required(),
  type: Joi.string().valid(...TYPES).required(),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  isActive: Joi.boolean(),
});

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.post('/seed-defaults', controller.seedDefaults);
router.put('/:id', validate(updateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
