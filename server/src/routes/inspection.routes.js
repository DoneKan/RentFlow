const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/inspection.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadMultiple } = require('../middleware/upload');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const TYPES = ['MOVE_IN', 'MOVE_OUT', 'ROUTINE'];
const CONDITIONS = ['GOOD', 'FAIR', 'POOR', 'DAMAGED'];

const createSchema = Joi.object({
  propertyId: Joi.string().required(),
  unitId: Joi.string().allow('', null),
  tenancyId: Joi.string().allow('', null),
  type: Joi.string().valid(...TYPES).default('ROUTINE'),
  scheduledDate: Joi.date().allow(null),
  overallNotes: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  scheduledDate: Joi.date().allow(null),
  overallNotes: Joi.string().allow('', null),
  status: Joi.string().valid('SCHEDULED', 'COMPLETED', 'CANCELLED'),
});

const itemSchema = Joi.object({
  area: Joi.string().required(),
  condition: Joi.string().valid(...CONDITIONS).default('GOOD'),
  notes: Joi.string().allow('', null),
});

const updateItemSchema = Joi.object({
  area: Joi.string(),
  condition: Joi.string().valid(...CONDITIONS),
  notes: Joi.string().allow('', null),
});

const completeSchema = Joi.object({
  overallNotes: Joi.string().allow('', null),
});

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(updateSchema), controller.update);
router.get('/:id/report', controller.getReport);
router.patch('/:id/complete', validate(completeSchema), controller.complete);
router.post('/:id/items', validate(itemSchema), controller.addItem);
router.put('/:id/items/:itemId', validate(updateItemSchema), controller.updateItem);
router.post('/:id/items/:itemId/photos', uploadMultiple('photos', 10), controller.addPhotos);
router.delete('/:id', controller.remove);

module.exports = router;
