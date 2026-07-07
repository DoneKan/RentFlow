const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/property.controller');
const { authenticate, authorize, optionalAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const createSchema = Joi.object({
  name: Joi.string().min(2).max(200).required(),
  type: Joi.string().valid('RESIDENTIAL', 'COMMERCIAL', 'MIXED').default('RESIDENTIAL'),
  description: Joi.string().allow('', null),
  address: Joi.string().required(),
  city: Joi.string().required(),
  district: Joi.string().allow('', null),
  country: Joi.string().length(2).default('UG'),
  latitude: Joi.number().allow(null),
  longitude: Joi.number().allow(null),
  amenities: Joi.array().items(Joi.string()).default([]),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(200),
  type: Joi.string().valid('RESIDENTIAL', 'COMMERCIAL', 'MIXED'),
  description: Joi.string().allow('', null),
  address: Joi.string(),
  city: Joi.string(),
  district: Joi.string().allow('', null),
  country: Joi.string().length(2),
  latitude: Joi.number().allow(null),
  longitude: Joi.number().allow(null),
  amenities: Joi.array().items(Joi.string()),
});

router.get('/vacant', controller.getVacant);
router.get('/', authenticate, controller.list);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(createSchema), controller.create);
router.get('/:id', authenticate, controller.getOne);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(updateSchema), controller.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN'), controller.remove);
router.get('/:id/units', authenticate, controller.getUnits);

module.exports = router;
