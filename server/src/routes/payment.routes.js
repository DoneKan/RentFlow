const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const manualPaymentSchema = Joi.object({
  invoiceId: Joi.string().required(),
  amount: Joi.number().positive().allow(null),
  method: Joi.string().valid('BANK_TRANSFER', 'CASH').required(),
  notes: Joi.string().allow('', null),
  paidAt: Joi.date().allow(null),
});

const mtnSchema = Joi.object({
  invoiceId: Joi.string().required(),
  mobileNumber: Joi.string().required(),
});

const airtelSchema = Joi.object({
  invoiceId: Joi.string().required(),
  mobileNumber: Joi.string().required(),
});

router.get('/', authenticate, controller.list);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(manualPaymentSchema), controller.recordManual);
router.get('/:id', authenticate, controller.getOne);
router.get('/:id/receipt', authenticate, controller.getReceipt);
router.post('/mtn/initiate', authenticate, validate(mtnSchema), controller.initiateMtn);
router.post('/airtel/initiate', authenticate, validate(airtelSchema), controller.initiateAirtel);
router.post('/webhook/mtn', controller.webhookMtn);
router.post('/webhook/airtel', controller.webhookAirtel);

module.exports = router;
