const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/prospect.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const STAGES = ['NEW', 'CONTACTED', 'SHOWING_SCHEDULED', 'SCREENING', 'APPROVED', 'REJECTED', 'CONVERTED', 'LOST'];

const createSchema = Joi.object({
  name: Joi.string().required(),
  phone: Joi.string().required(),
  email: Joi.string().email().allow('', null),
  source: Joi.string().valid('WALK_IN', 'REFERRAL', 'PHONE', 'ONLINE', 'OTHER').default('OTHER'),
  propertyId: Joi.string().allow('', null),
  unitId: Joi.string().allow('', null),
  showingDate: Joi.date().allow(null),
  notes: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  name: Joi.string(),
  phone: Joi.string(),
  email: Joi.string().email().allow('', null),
  source: Joi.string().valid('WALK_IN', 'REFERRAL', 'PHONE', 'ONLINE', 'OTHER'),
  propertyId: Joi.string().allow('', null),
  unitId: Joi.string().allow('', null),
  showingDate: Joi.date().allow(null),
  notes: Joi.string().allow('', null),
});

const stageSchema = Joi.object({
  stage: Joi.string().valid(...STAGES).required(),
});

const screeningSchema = Joi.object({
  idNumber: Joi.string().allow('', null),
  employerName: Joi.string().allow('', null),
  monthlyIncome: Joi.number().positive().allow(null),
  previousLandlordName: Joi.string().allow('', null),
  previousLandlordPhone: Joi.string().allow('', null),
  references: Joi.array().items(Joi.string()),
  screeningStatus: Joi.string().valid('NOT_STARTED', 'IN_PROGRESS', 'APPROVED', 'REJECTED'),
  screeningNotes: Joi.string().allow('', null),
});

const convertSchema = Joi.object({
  tenancyId: Joi.string().required(),
});

router.use(authenticate, authorize(...STAFF_ROLES));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', validate(updateSchema), controller.update);
router.patch('/:id/stage', validate(stageSchema), controller.updateStage);
router.patch('/:id/screening', validate(screeningSchema), controller.updateScreening);
router.post('/:id/convert', validate(convertSchema), controller.markConverted);
router.delete('/:id', controller.remove);

module.exports = router;
