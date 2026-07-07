const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/unit.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router({ mergeParams: true });

const createSchema = Joi.object({
  unitNumber: Joi.string().required(),
  floor: Joi.number().integer().allow(null),
  type: Joi.string().default('1-bedroom'),
  bedrooms: Joi.number().integer().min(0).default(1),
  bathrooms: Joi.number().integer().min(0).default(1),
  squareMeters: Joi.number().positive().allow(null),
  rentAmount: Joi.number().positive().required(),
  additionalCharges: Joi.object().default({}),
  paymentPeriod: Joi.string().valid('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL').default('MONTHLY'),
});

const updateSchema = Joi.object({
  unitNumber: Joi.string(),
  floor: Joi.number().integer().allow(null),
  type: Joi.string(),
  bedrooms: Joi.number().integer().min(0),
  bathrooms: Joi.number().integer().min(0),
  squareMeters: Joi.number().positive().allow(null),
  rentAmount: Joi.number().positive(),
  additionalCharges: Joi.object(),
  paymentPeriod: Joi.string().valid('MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'),
  status: Joi.string().valid('VACANT', 'OCCUPIED', 'MAINTENANCE'),
});

// Standalone unit routes
router.get('/', authenticate, controller.list);
router.get('/:id', authenticate, controller.getOne);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(updateSchema), controller.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.remove);

// Nested under property (mergeParams)
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(createSchema), controller.create);

module.exports = router;
