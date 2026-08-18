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

router.use(authenticate);

// Accountant can view the chart of accounts but not restructure it —
// creating/editing/removing accounts is a one-time setup task, not
// day-to-day bookkeeping.
router.get('/', authorize(...STAFF_ROLES, 'ACCOUNTANT'), controller.list);
router.post('/', authorize(...STAFF_ROLES), validate(createSchema), controller.create);
router.post('/seed-defaults', authorize(...STAFF_ROLES), controller.seedDefaults);
router.put('/:id', authorize(...STAFF_ROLES), validate(updateSchema), controller.update);
router.delete('/:id', authorize(...STAFF_ROLES), controller.remove);

module.exports = router;
