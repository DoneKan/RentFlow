const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/tenant.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const createSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  phone: Joi.string().allow('', null),
  unitId: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null),
  rentAmount: Joi.number().positive().allow(null),
  depositAmount: Joi.number().min(0).default(0),
  notes: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  phone: Joi.string().allow('', null),
  rentAmount: Joi.number().positive(),
  depositAmount: Joi.number().min(0),
  endDate: Joi.date().allow(null),
  notes: Joi.string().allow('', null),
});

router.get('/portal/me', authenticate, controller.getMyPortal);
router.get('/', authenticate, controller.list);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(createSchema), controller.create);
router.get('/:id', authenticate, controller.getOne);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(updateSchema), controller.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.terminate);

module.exports = router;
