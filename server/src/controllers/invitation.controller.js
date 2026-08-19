const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendInvitationEmail } = require('../utils/emailService');
const { generateToken } = require('./auth.controller');
const logger = require('../utils/logger');

const prisma = require('../utils/prisma');

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Same reasoning as PasswordResetToken: the raw token is only ever emailed,
// never stored — only its hash is, so a leaked database doesn't hand out
// usable invite links.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function invitationStatus(inv) {
  if (inv.revokedAt) return 'REVOKED';
  if (inv.acceptedAt) return 'ACCEPTED';
  if (inv.expiresAt < new Date()) return 'EXPIRED';
  return 'PENDING';
}

function sanitize(inv) {
  const { tokenHash, ...rest } = inv;
  return { ...rest, status: invitationStatus(inv) };
}

async function list(req, res, next) {
  try {
    const invitations = await prisma.invitation.findMany({
      where: { organizationId: req.user.organizationId },
      include: { invitedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ApiResponse.success(res, invitations.map(sanitize));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { email, role } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      throw ApiError.conflict('That email already belongs to an existing account.');
    }

    const inviter = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });

    // A fresh invite to an email that already has a still-usable one for
    // this org replaces it, rather than leaving two valid links alive —
    // same idea as forgotPassword invalidating earlier reset tokens.
    await prisma.invitation.updateMany({
      where: {
        organizationId: req.user.organizationId,
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invitation = await prisma.invitation.create({
      data: {
        organizationId: req.user.organizationId,
        email: normalizedEmail,
        role,
        tokenHash: hashToken(rawToken),
        invitedById: req.user.id,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      include: { invitedBy: { select: { name: true } } },
    });

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
    const acceptUrl = `${clientUrl}/accept-invite?token=${rawToken}`;
    sendInvitationEmail({
      email: normalizedEmail,
      organizationName: inviter.organization.name,
      role,
      invitedByName: inviter.name,
      acceptUrl,
    }).catch((e) => logger.error('Invitation email failed:', e));

    return ApiResponse.created(res, sanitize(invitation), 'Invitation sent');
  } catch (err) {
    next(err);
  }
}

async function revoke(req, res, next) {
  try {
    const invitation = await prisma.invitation.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!invitation) throw ApiError.notFound('Invitation not found');
    if (invitationStatus(invitation) !== 'PENDING') {
      throw ApiError.badRequest('Only a pending invitation can be revoked');
    }

    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { revokedAt: new Date() },
    });

    return ApiResponse.success(res, null, 'Invitation revoked');
  } catch (err) {
    next(err);
  }
}

// Public — no auth. Lets the accept-invite page show who invited the
// visitor and to what, before they've created any account.
async function verify(req, res, next) {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { tokenHash: hashToken(req.params.token) },
      include: { organization: { select: { name: true } }, invitedBy: { select: { name: true } } },
    });

    if (!invitation) throw ApiError.notFound('This invitation link is invalid.');
    const status = invitationStatus(invitation);
    if (status !== 'PENDING') {
      throw ApiError.badRequest(
        status === 'ACCEPTED' ? 'This invitation has already been accepted.'
          : status === 'REVOKED' ? 'This invitation has been revoked.'
          : 'This invitation has expired — ask for a new one.'
      );
    }

    return ApiResponse.success(res, {
      email: invitation.email,
      role: invitation.role,
      organizationName: invitation.organization.name,
      invitedByName: invitation.invitedBy.name,
    });
  } catch (err) {
    next(err);
  }
}

// Public — no auth. Creates the actual User row and logs the new member in.
async function accept(req, res, next) {
  try {
    const { token, name, password } = req.body;

    const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!invitation) throw ApiError.notFound('This invitation link is invalid.');
    const status = invitationStatus(invitation);
    if (status !== 'PENDING') {
      throw ApiError.badRequest(
        status === 'ACCEPTED' ? 'This invitation has already been accepted.'
          : status === 'REVOKED' ? 'This invitation has been revoked.'
          : 'This invitation has expired — ask for a new one.'
      );
    }

    // Re-check at accept time too — the email could have been claimed by
    // someone else between when the invite was sent and now.
    const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
    if (existingUser) throw ApiError.conflict('That email already belongs to an existing account.');

    const hashed = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email: invitation.email,
          password: hashed,
          role: invitation.role,
          organizationId: invitation.organizationId,
        },
        include: { organization: true },
      });
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });
      return user;
    });

    const jwtToken = generateToken(result);
    const { password: _pw, ...safeUser } = result;

    return ApiResponse.success(res, { user: safeUser, token: jwtToken }, 'Invitation accepted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, revoke, verify, accept };
