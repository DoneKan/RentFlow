const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { sendWelcomeEmail } = require('../utils/emailService');
const logger = require('../utils/logger');

const prisma = require('../utils/prisma');
const { applyTenantDisplay, applyTenantDisplayAll } = require('../utils/tenancyHelpers');
const { syncEndedTenancies } = require('../jobs/invoiceJob');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, propertyId, status = 'ACTIVE' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    await syncEndedTenancies(req.user.organizationId);

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

    applyTenantDisplayAll(tenancies, null);

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
      paymentPeriod,
      customIntervalMonths,
      notes,
    } = req.body;

    // A unit whose previous tenancy has already passed its End Date should
    // read as vacant here, not still blocked by a lapsed-but-not-yet-synced
    // ACTIVE tenancy.
    await syncEndedTenancies(req.user.organizationId);

    const unit = await prisma.unit.findFirst({
      where: {
        id: unitId,
        property: { organizationId: req.user.organizationId },
      },
      include: { property: true },
    });
    if (!unit) throw ApiError.notFound('Unit not found');
    if (unit.status !== 'VACANT') throw ApiError.conflict('Unit is not vacant');

    // Email is optional now — normalize a blank string to null so it never
    // collides with another email-less tenant under the @unique constraint
    // (Postgres treats every NULL as distinct). Without an email there's no
    // identity to look an existing account up by, so an email-less tenant
    // always gets a brand-new User — only a shared, non-blank email can
    // trigger the reuse-existing-account path below.
    const normalizedEmail = email ? email.trim().toLowerCase() : null;
    let tenantUser = normalizedEmail ? await prisma.user.findUnique({ where: { email: normalizedEmail } }) : null;

    await prisma.$transaction(async (tx) => {
      if (!tenantUser) {
        const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
        const hashed = await bcrypt.hash(tempPassword, 12);
        tenantUser = await tx.user.create({
          data: {
            name,
            email: normalizedEmail,
            password: hashed,
            phone,
            role: 'TENANT',
            organizationId: req.user.organizationId,
          },
        });
        if (tenantUser.email) {
          sendWelcomeEmail(tenantUser).catch((e) => logger.error('Tenant welcome email failed:', e));
        }
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
          tenantName: name,
          tenantPhone: phone,
          // Per-tenancy snapshot, same reasoning as tenantName/tenantPhone
          // and rentAmount above — the unit's own paymentPeriod is only the
          // default at assignment time, not something later unit edits
          // should silently reach back and change for an already-billing
          // tenancy.
          paymentPeriod: paymentPeriod || unit.paymentPeriod,
          customIntervalMonths: paymentPeriod === 'CUSTOM' ? customIntervalMonths : null,
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

    return ApiResponse.created(res, applyTenantDisplay(tenancy, null), 'Tenant added successfully');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    await syncEndedTenancies(req.user.organizationId);

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

    return ApiResponse.success(res, applyTenantDisplay(tenancy, null));
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

    // name/phone are this tenancy's own contact snapshot (tenantName/
    // tenantPhone), not the linked User's fields — the linked User is a
    // login account that can be shared across multiple tenancies (e.g. an
    // org reusing one email because it never collected a per-tenant email),
    // so writing to the User here would silently rename every other
    // tenancy sharing that account too.
    await prisma.tenancy.update({
      where: { id: req.params.id },
      data: {
        ...(name && { tenantName: name }),
        ...(phone !== undefined && { tenantPhone: phone }),
        ...(rentAmount !== undefined && { rentAmount }),
        ...(depositAmount !== undefined && { depositAmount }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    const updated = await prisma.tenancy.findUnique({
      where: { id: req.params.id },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        unit: { select: { id: true, unitNumber: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return ApiResponse.success(res, applyTenantDisplay(updated, null), 'Tenant updated');
  } catch (err) {
    next(err);
  }
}

async function terminate(req, res, next) {
  try {
    // Sync first — if this tenancy's own End Date already passed, it should
    // read as already-ended (and error out below) rather than let a manual
    // Terminate race the automatic transition.
    await syncEndedTenancies(req.user.organizationId);

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
    await syncEndedTenancies(req.user.organizationId);

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
