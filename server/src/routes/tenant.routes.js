const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/tenant.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const PAYMENT_PERIODS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM'];

const createSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  // Phone is the reliable channel for SMS (reminders, payment
  // confirmations) so it's required; email stays optional — used for
  // emailing invoices/receipts and portal login when a tenant has one, but
  // many landlords never collect it per-tenant.
  email: Joi.string().email().lowercase().allow('', null),
  phone: Joi.string().required(),
  unitId: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().allow(null),
  rentAmount: Joi.number().positive().allow(null),
  depositAmount: Joi.number().min(0).default(0),
  // Optional — falls back to the unit's own default payment period
  // server-side when omitted (e.g. from older/other callers).
  paymentPeriod: Joi.string().valid(...PAYMENT_PERIODS).allow(null),
  customIntervalMonths: Joi.number().integer().positive().when('paymentPeriod', {
    is: 'CUSTOM',
    then: Joi.required(),
    otherwise: Joi.allow(null),
  }),
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
router.get('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.list);
router.post('/', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(createSchema), controller.create);
router.get('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.getOne);
router.put('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), validate(updateSchema), controller.update);
router.delete('/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'), controller.terminate);

module.exports = router;
