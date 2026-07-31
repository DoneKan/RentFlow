const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/lease.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];

const createSchema = Joi.object({
  tenancyId: Joi.string().required(),
});

const signSchema = Joi.object({
  signatureDataUrl: Joi.string().required(),
  signerName: Joi.string().required(),
});

router.use(authenticate);

router.get('/', controller.list);
router.post('/', authorize(...STAFF_ROLES), validate(createSchema), controller.create);
router.get('/:id', controller.getOne);
router.get('/:id/download', controller.download);
router.post('/:id/sign', validate(signSchema), controller.sign);
router.post('/:id/void', authorize(...STAFF_ROLES), controller.void);

module.exports = router;
