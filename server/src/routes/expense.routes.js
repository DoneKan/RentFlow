const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/expense.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadSingle } = require('../middleware/upload');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

const createSchema = Joi.object({
  propertyId: Joi.string().required(),
  unitId: Joi.string().allow('', null),
  category: Joi.string().valid('UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'LAND_ACQUISITION', 'CONSTRUCTION', 'OTHER').default('OTHER'),
  amount: Joi.number().positive().required(),
  description: Joi.string().required(),
  date: Joi.date().required(),
  vendor: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  unitId: Joi.string().allow('', null),
  category: Joi.string().valid('UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'LAND_ACQUISITION', 'CONSTRUCTION', 'OTHER'),
  amount: Joi.number().positive(),
  description: Joi.string(),
  date: Joi.date(),
  vendor: Joi.string().allow('', null),
});

router.get('/summary', authenticate, authorize(...STAFF_ROLES), controller.summary);
router.get('/', authenticate, authorize(...STAFF_ROLES), controller.list);
router.post('/', authenticate, authorize(...STAFF_ROLES), uploadSingle('receipt'), validate(createSchema), controller.create);
router.get('/:id', authenticate, authorize(...STAFF_ROLES), controller.getOne);
router.put('/:id', authenticate, authorize(...STAFF_ROLES), uploadSingle('receipt'), validate(updateSchema), controller.update);
router.delete('/:id', authenticate, authorize(...STAFF_ROLES), controller.remove);

module.exports = router;
