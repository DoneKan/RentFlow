const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { verifyWebhookSignature } = require('../middleware/webhookSignature');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
// Recording payments is core bookkeeping — Accountant gets full access here,
// unlike most other STAFF_ROLES-gated areas.
const PAYMENT_ROLES = [...STAFF_ROLES, 'ACCOUNTANT'];

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

router.get('/', authenticate, authorize(...PAYMENT_ROLES), controller.list);
router.post('/', authenticate, authorize(...PAYMENT_ROLES), validate(manualPaymentSchema), controller.recordManual);
router.get('/:id', authenticate, authorize(...PAYMENT_ROLES), controller.getOne);
router.get('/:id/receipt', authenticate, authorize(...PAYMENT_ROLES), controller.getReceipt);
router.post('/mtn/initiate', authenticate, authorize(...PAYMENT_ROLES), validate(mtnSchema), controller.initiateMtn);
router.post('/airtel/initiate', authenticate, authorize(...PAYMENT_ROLES), validate(airtelSchema), controller.initiateAirtel);
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
