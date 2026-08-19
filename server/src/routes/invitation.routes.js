const { Router } = require('express');
const Joi = require('joi');
const controller = require('../controllers/invitation.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = Router();

// Deliberately narrower than STAFF_ROLES used elsewhere — inviting someone
// into the org and handing them a role is a higher-trust action than the
// day-to-day operations PROPERTY_MANAGER/LANDLORD/ACCOUNTANT can already
// do, so only Admin (and platform Super Admin) can send/manage invites.
const INVITE_MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// SUPER_ADMIN is a platform-level role, not something a customer's own
// Admin should be able to grant to someone else. TENANT/OWNER are created
// through entirely different flows (Add Tenant, and there is no
// self-service Owner signup at all yet) — this invite flow is for staff
// accounts only.
const INVITABLE_ROLES = ['ADMIN', 'PROPERTY_MANAGER', 'LANDLORD', 'ACCOUNTANT'];

const createSchema = Joi.object({
  email: Joi.string().email().required(),
  role: Joi.string().valid(...INVITABLE_ROLES).required(),
});

const acceptSchema = Joi.object({
  token: Joi.string().required(),
  name: Joi.string().min(2).max(100).required(),
  password: Joi.string().min(8).required(),
});

// Public — no auth, these are how a visitor holding an emailed link
// actually gets in.
router.get('/verify/:token', controller.verify);
router.post('/accept', validate(acceptSchema), controller.accept);

router.use(authenticate, authorize(...INVITE_MANAGER_ROLES));

router.get('/', controller.list);
router.post('/', validate(createSchema), controller.create);
router.delete('/:id', controller.revoke);

module.exports = router;
