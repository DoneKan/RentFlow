const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/invoice.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

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
  notes: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  dueDate: Joi.date(),
  latePenalty: Joi.number().min(0),
  customItems: Joi.array().items(
    Joi.object({
      description: Joi.string().required(),
      amount: Joi.number().positive().required(),
      type: Joi.string().default('charge'),
    })
  ),
  notes: Joi.string().allow('', null),
}).min(1);

router.get('/', authenticate, authorize(...STAFF_ROLES), controller.list);
router.post('/', authenticate, authorize(...STAFF_ROLES), validate(createSchema), controller.create);
router.get('/:id', authenticate, authorize(...STAFF_ROLES), controller.getOne);
router.put('/:id', authenticate, authorize(...STAFF_ROLES), validate(updateSchema), controller.update);
router.post('/:id/send', authenticate, authorize(...STAFF_ROLES), controller.sendInvoice);
router.post('/:id/remind', authenticate, authorize(...STAFF_ROLES), controller.sendReminder);
router.put('/:id/cancel', authenticate, authorize(...STAFF_ROLES), controller.cancel);

module.exports = router;
