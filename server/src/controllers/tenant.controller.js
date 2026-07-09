const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendWelcomeEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, propertyId, status = 'ACTIVE' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tenancies, total] = await Promise.all([
      prisma.tenancy.findMany({
        where: {
          property: { organizationId: req.user.organizationId },
          ...(propertyId && { propertyId }),
          ...(status && { status }),
        },
        include: {
          tenant: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
          unit: { select: { id: true, unitNumber: true, type: true, rentAmount: true } },
          property: { select: { id: true, name: true, code: true, city: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.tenancy.count({
        where: {
          property: { organizationId: req.user.organizationId },
          ...(propertyId && { propertyId }),
          ...(status && { status }),
        },
      }),
    ]);

    return ApiResponse.paginated(res, tenancies, {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      name,
      email,
      phone,
      unitId,
      startDate,
      endDate,
      rentAmount,
      depositAmount,
      notes,
    } = req.body;

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        property: { organizationId: req.user.organizationId },
      },
      include: { property: true },
    });
    if (!unit) throw ApiError.notFound('Unit not found');
    if (unit.status !== 'VACANT') throw ApiError.conflict('Unit is not vacant');

    // Check if email already exists as a user
    let tenantUser = await prisma.user.findUnique({ where: { email } });

    await prisma.$transaction(async (tx) => {
      if (!tenantUser) {
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
        const hashed = await bcrypt.hash(tempPassword, 12);
        tenantUser = await tx.user.create({
          data: {
            name,
            email,
            password: hashed,
            phone,
            role: 'TENANT',
            organizationId: req.user.organizationId,
          },
        });
        sendWelcomeEmail(tenantUser).catch((e) => logger.error('Tenant welcome email failed:', e));
      }

      const tenancy = await tx.tenancy.create({
        data: {
          unitId,
          tenantId: tenantUser.id,
          propertyId: unit.propertyId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : undefined,
          rentAmount: rentAmount || unit.rentAmount,
          depositAmount: depositAmount || 0,
          status: 'ACTIVE',
          notes,
        },
      });

      await tx.unit.update({
        where: { id: unitId },
        data: { status: 'OCCUPIED' },
      });

      return tenancy;
    });

    const tenancy = await prisma.tenancy.findFirst({
      where: { unitId, status: 'ACTIVE' },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        unit: { select: { id: true, unitNumber: true, type: true, rentAmount: true } },
        property: { select: { id: true, name: true, code: true } },
      },
    });

    return ApiResponse.created(res, tenancy, 'Tenant added successfully');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true, createdAt: true } },
        unit: true,
        property: { select: { id: true, name: true, code: true, address: true, city: true } },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { payments: { where: { status: 'COMPLETED' } } },
        },
        maintenanceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!tenancy) throw ApiError.notFound('Tenancy not found');

    return ApiResponse.success(res, tenancy);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!tenancy) throw ApiError.notFound('Tenancy not found');

    const { name, phone, rentAmount, depositAmount, endDate, notes } = req.body;

    await prisma.$transaction(async (tx) => {
      if (name || phone) {
        await tx.user.update({
          where: { id: tenancy.tenantId },
          data: { ...(name && { name }), ...(phone !== undefined && { phone }) },
        });
      }

      await tx.tenancy.update({
        where: { id: req.params.id },
        data: {
          ...(rentAmount !== undefined && { rentAmount }),
          ...(depositAmount !== undefined && { depositAmount }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          ...(notes !== undefined && { notes }),
        },
      });
    });

    const updated = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        unit: { select: { id: true, unitNumber: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return ApiResponse.success(res, updated, 'Tenant updated');
  } catch (err) {
    next(err);
  }
}

async function terminate(req, res, next) {
  try {
    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!tenancy) throw ApiError.notFound('Tenancy not found');
    if (tenancy.status !== 'ACTIVE') throw ApiError.badRequest('Tenancy is not active');

    await prisma.$transaction(async (tx) => {
      await tx.tenancy.update({
        where: { id: req.params.id },
        data: { status: 'TERMINATED', endDate: new Date() },
      });
      await tx.unit.update({
        where: { id: tenancy.unitId },
        data: { status: 'VACANT' },
      });
    });

    return ApiResponse.success(res, null, 'Tenancy terminated and unit is now vacant');
  } catch (err) {
    next(err);
  }
}

async function getMyPortal(req, res, next) {
  try {
    const tenancy = await prisma.tenancy.findFirst({
      where: { tenantId: req.user.id, status: 'ACTIVE' },
      include: {
        unit: true,
        property: {
          select: {
            id: true, name: true, code: true, address: true, city: true,
            organization: { select: { name: true, phone: true, email: true, currency: true } },
          },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { payments: true },
        },
      },
    });

    if (!tenancy) throw ApiError.notFound('No active tenancy found');

    const invoices = tenancy.invoices.map((inv) => ({
      ...inv,
      items: (() => { try { return JSON.parse(inv.items); } catch { return []; } })(),
    }));

    return ApiResponse.success(res, { ...tenancy, invoices });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, terminate, getMyPortal };
