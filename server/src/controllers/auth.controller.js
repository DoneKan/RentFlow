const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendWelcomeEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

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

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
}

function sanitizeUser(user) {
  const { password, ...rest } = user;
  return rest;
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

      return { user, org };
    });

    const token = generateToken(result.user);
    const refreshToken = generateRefreshToken(result.user);

    sendWelcomeEmail(result.user).catch((e) => logger.error('Welcome email failed:', e));

    return ApiResponse.created(res, {
      user: sanitizeUser(result.user),
      token,
      refreshToken,
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
    const refreshToken = generateRefreshToken(user);

    return ApiResponse.success(res, {
      user: sanitizeUser(user),
      token,
      refreshToken,
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

module.exports = { register, login, logout, getMe, updateMe, changePassword, generateToken };
