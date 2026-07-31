const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/vendor.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'CLEANING', 'PEST_CONTROL', 'CARPENTRY', 'PAINTING', 'GENERAL', 'OTHER'];

const createSchema = Joi.object({
  name: Joi.string().required(),
  category: Joi.string().valid(...CATEGORIES).default('GENERAL'),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  address: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  category: Joi.string().valid(...CATEGORIES),
  phone: Joi.string().allow('', null),
  email: Joi.string().email().allow('', null),
  address: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  isActive: Joi.boolean(),
});

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize(...STAFF_ROLES), validate(createSchema), controller.create);
router.get('/:id', controller.getOne);
router.get('/:id/history', controller.getHistory);
router.put('/:id', authorize(...STAFF_ROLES), validate(updateSchema), controller.update);
router.delete('/:id', authorize(...STAFF_ROLES), controller.remove);

module.exports = router;
