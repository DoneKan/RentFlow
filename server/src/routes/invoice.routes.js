const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/invoice.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const createSchema = Joi.object({
  tenancyId: Joi.string().required(),
  dueDate: Joi.date().required(),
  latePenalty: Joi.number().min(0).default(0),
  customItems: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      amount: Joi.number().positive().required(),
      type: Joi.string().default('charge'),
    })
  ).allow(null),
});

router.get('/', authenticate, controller.list);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(createSchema), controller.create);
router.get('/:id', authenticate, controller.getOne);
router.post('/:id/send', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.sendInvoice);
router.post('/:id/remind', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.sendReminder);
router.put('/:id/cancel', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.cancel);

module.exports = router;
