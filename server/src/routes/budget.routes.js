const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/budget.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const CATEGORIES = ['UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'LAND_ACQUISITION', 'CONSTRUCTION', 'OTHER', 'RENTAL_INCOME'];

const lineSchema = Joi.object({
  category: Joi.string().valid(...CATEGORIES).required(),
  plannedAmount: Joi.number().positive().required(),
  notes: Joi.string().allow('', null),
});

const createSchema = Joi.object({
  propertyId: Joi.string().allow('', null),
  name: Joi.string().required(),
  periodStart: Joi.date().required(),
  periodEnd: Joi.date().required(),
  currency: Joi.string().default('UGX'),
  lines: Joi.array().items(lineSchema).default([]),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  periodStart: Joi.date(),
  periodEnd: Joi.date(),
  currency: Joi.string(),
  lines: Joi.array().items(lineSchema),
});

router.use(authenticate);

// Accountant can view budgets and variance but not set/edit them — planning
// the budget is a management decision, not bookkeeping.
router.get('/', authorize(...STAFF_ROLES, 'ACCOUNTANT'), controller.list);
router.post('/', authorize(...STAFF_ROLES), validate(createSchema), controller.create);
router.get('/:id', authorize(...STAFF_ROLES, 'ACCOUNTANT'), controller.getOne);
router.put('/:id', authorize(...STAFF_ROLES), validate(updateSchema), controller.update);
router.get('/:id/variance', authorize(...STAFF_ROLES, 'ACCOUNTANT'), controller.variance);
router.delete('/:id', authorize(...STAFF_ROLES), controller.remove);

module.exports = router;
