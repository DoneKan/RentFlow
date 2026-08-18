const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/landlordExpenseReminder.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const RECURRENCE_TYPES = ['MONTHLY', 'ANNUAL', 'CUSTOM'];

const createSchema = Joi.object({
  propertyId: Joi.string().allow('', null),
  name: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('', null),
  amount: Joi.number().positive().required(),
  recurrenceType: Joi.string().valid(...RECURRENCE_TYPES).required(),
  customIntervalDays: Joi.number().integer().positive().when('recurrenceType', {
    is: 'CUSTOM',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
  nextDueDate: Joi.date().required(),
  remindDaysBefore: Joi.number().integer().min(0).max(90).default(7),
});

const updateSchema = Joi.object({
  propertyId: Joi.string().allow('', null),
  name: Joi.string().min(2).max(200),
  description: Joi.string().allow('', null),
  amount: Joi.number().positive(),
  recurrenceType: Joi.string().valid(...RECURRENCE_TYPES),
  customIntervalDays: Joi.number().integer().positive().allow(null),
  nextDueDate: Joi.date(),
  remindDaysBefore: Joi.number().integer().min(0).max(90),
  isActive: Joi.boolean(),
});

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(updateSchema), controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
