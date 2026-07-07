const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/expense.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');

const router = Router();

const createSchema = Joi.object({
  propertyId: Joi.string().required(),
  category: Joi.string().valid('UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'OTHER').default('OTHER'),
  amount: Joi.number().positive().required(),
  description: Joi.string().required(),
  date: Joi.date().required(),
  vendor: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  category: Joi.string().valid('UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'OTHER'),
  amount: Joi.number().positive(),
  description: Joi.string(),
  date: Joi.date(),
  vendor: Joi.string().allow('', null),
});

router.get('/summary', authenticate, controller.summary);
router.get('/', authenticate, controller.list);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), uploadSingle('receipt'), validate(createSchema), controller.create);
router.get('/:id', authenticate, controller.getOne);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), uploadSingle('receipt'), validate(updateSchema), controller.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.remove);

module.exports = router;
