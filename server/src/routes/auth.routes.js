const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().allow('', null),
  organizationName: Joi.string().min(2).max(200).required(),
  organizationType: Joi.string().valid('INDIVIDUAL', 'COMPANY').default('INDIVIDUAL'),
  registrationNumber: Joi.string().allow('', null),
  country: Joi.string().length(2).default('UG'),
  currency: Joi.string().default('UGX'),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required(),
});

const updateMeSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  phone: Joi.string().allow('', null),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required(),
});

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.post('/logout', authenticate, controller.logout);
router.get('/me', authenticate, controller.getMe);
router.put('/me', authenticate, validate(updateMeSchema), controller.updateMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), controller.changePassword);

module.exports = router;
