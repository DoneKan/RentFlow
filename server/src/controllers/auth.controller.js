const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendWelcomeEmail, sendPasswordResetEmail } = require('../utils/emailService');
const { seedDefaultChartOfAccounts } = require('../utils/defaultChartOfAccounts');
const logger = require('../utils/logger');

const prisma = require('../utils/prisma');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// The raw token is emailed to the user and never stored — only its hash is,
// so a leaked database doesn't hand out usable reset links. SHA-256 (not
// bcrypt) is correct here: the token already carries 256 bits of entropy
// from crypto.randomBytes, so it's brute-force-infeasible regardless of
// hash speed — unlike a password, which needs a slow hash to compensate
// for low entropy.
function hashResetToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

async function register(req, res, next) {
  try {
    const {
      name,
      email,
      password,
      phone,
      organizationName,
      organizationType = 'INDIVIDUAL',
      registrationNumber,
      country = 'UG',
      currency = 'UGX',
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw ApiError.conflict('Email already registered');
    }

    const hashed = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: organizationName,
          type: organizationType,
          registrationNumber,
          email,
          phone,
          country,
          currency,
          plan: 'FREE',
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashed,
          phone,
          role: 'ADMIN',
          organizationId: org.id,
        },
        include: { organization: true },
      });

      await seedDefaultChartOfAccounts(tx, org.id);

      return { user, org };
    });

    const token = generateToken(result.user);

    sendWelcomeEmail(result.user).catch((e) => logger.error('Welcome email failed:', e));

    return ApiResponse.created(res, {
      user: sanitizeUser(result.user),
      token,
    }, 'Account created successfully');
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const token = generateToken(user);

    return ApiResponse.success(res, {
      user: sanitizeUser(user),
      token,
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  return ApiResponse.success(res, null, 'Logged out successfully');
}

async function getMe(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    });

    if (!user) throw ApiError.notFound('User not found');

    return ApiResponse.success(res, sanitizeUser(user));
  } catch (err) {
    next(err);
  }
}

async function updateMe(req, res, next) {
  try {
    const { name, phone } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { name, phone },
      include: { organization: true },
    });

    return ApiResponse.success(res, sanitizeUser(user), 'Profile updated');
  } catch (err) {
    next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) throw ApiError.notFound('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw ApiError.badRequest('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed },
    });

    return ApiResponse.success(res, null, 'Password changed successfully');
  } catch (err) {
    next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond the same way whether or not the email is registered —
    // a different message/status here would let this endpoint be used to
    // enumerate valid accounts.
    if (user && user.isActive) {
      // Invalidate any still-usable tokens from earlier requests so only
      // the most recently emailed link works.
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      const rawToken = crypto.randomBytes(32).toString('hex');
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashResetToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim();
      const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;
      sendPasswordResetEmail(user, resetUrl).catch((e) => logger.error('Password reset email failed:', e));
    }

    return ApiResponse.success(res, null, 'If that email is registered, a password reset link has been sent.');
  } catch (err) {
    next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const { token, newPassword } = req.body;

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
    }

    const hashed = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetToken.userId }, data: { password: hashed } }),
      prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    ]);

    return ApiResponse.success(res, null, 'Password reset successfully. You can now log in with your new password.');
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register, login, logout, getMe, updateMe, changePassword,
  forgotPassword, resetPassword, generateToken,
};
