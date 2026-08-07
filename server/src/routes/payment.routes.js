const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { verifyWebhookSignature } = require('../middleware/webhookSignature');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

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

router.get('/', authenticate, authorize(...STAFF_ROLES), controller.list);
router.post('/', authenticate, authorize(...STAFF_ROLES), validate(manualPaymentSchema), controller.recordManual);
router.get('/:id', authenticate, authorize(...STAFF_ROLES), controller.getOne);
router.get('/:id/receipt', authenticate, authorize(...STAFF_ROLES), controller.getReceipt);
router.post('/mtn/initiate', authenticate, authorize(...STAFF_ROLES), validate(mtnSchema), controller.initiateMtn);
router.post('/airtel/initiate', authenticate, authorize(...STAFF_ROLES), validate(airtelSchema), controller.initiateAirtel);
router.post(
  '/webhook/mtn',
  verifyWebhookSignature({ headerName: 'X-Mtn-Signature', secretEnvVar: 'MTN_WEBHOOK_SECRET' }),
  controller.webhookMtn
);
router.post(
  '/webhook/airtel',
  verifyWebhookSignature({ headerName: 'X-Airtel-Signature', secretEnvVar: 'AIRTEL_WEBHOOK_SECRET' }),
  controller.webhookAirtel
);

module.exports = router;
