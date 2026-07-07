const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

function parseUnit(unit) {
  if (!unit) return unit;
  try {
    return {
      ...unit,
      additionalCharges: typeof unit.additionalCharges === 'string'
        ? JSON.parse(unit.additionalCharges)
        : (unit.additionalCharges || {}),
    };
  } catch {
    return { ...unit, additionalCharges: {} };
  }
}

async function list(req, res, next) {
  try {
    const { status, propertyId } = req.query;

    const units = await prisma.unit.findMany({
      where: {
        property: { organizationId: req.user.organizationId },
        ...(status && { status }),
        ...(propertyId && { propertyId }),
      },
      include: {
        property: { select: { id: true, name: true, code: true, city: true } },
        tenancy: {
          where: { status: 'ACTIVE' },
          include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
      orderBy: [{ propertyId: 'asc' }, { unitNumber: 'asc' }],
    });

    return ApiResponse.success(res, units.map(parseUnit));
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { propertyId } = req.params;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId: req.user.organizationId },
    });
    if (!property) throw ApiError.notFound('Property not found');

    const { unitNumber, floor, type, bedrooms, bathrooms, squareMeters, rentAmount, additionalCharges, paymentPeriod } = req.body;

    const unit = await prisma.unit.create({
      data: {
        propertyId,
        unitNumber,
        floor: floor ? parseInt(floor) : undefined,
        type: type || '1-bedroom',
        bedrooms: bedrooms ? parseInt(bedrooms) : 1,
        bathrooms: bathrooms ? parseInt(bathrooms) : 1,
        squareMeters: squareMeters ? parseFloat(squareMeters) : undefined,
        rentAmount,
        additionalCharges: JSON.stringify(additionalCharges || {}),
        paymentPeriod: paymentPeriod || 'MONTHLY',
        status: 'VACANT',
      },
    });

    return ApiResponse.created(res, parseUnit(unit), 'Unit created successfully');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const unit = await prisma.unit.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
      include: {
        property: true,
        tenancy: {
          where: { status: 'ACTIVE' },
          include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
    });

    if (!unit) throw ApiError.notFound('Unit not found');

    return ApiResponse.success(res, parseUnit(unit));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const unit = await prisma.unit.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!unit) throw ApiError.notFound('Unit not found');

    const { unitNumber, floor, type, bedrooms, bathrooms, squareMeters, rentAmount, additionalCharges, paymentPeriod, status } = req.body;

    const updated = await prisma.unit.update({
      where: { id: req.params.id },
      data: {
        ...(unitNumber && { unitNumber }),
        ...(floor !== undefined && { floor: parseInt(floor) }),
        ...(type && { type }),
        ...(bedrooms !== undefined && { bedrooms: parseInt(bedrooms) }),
        ...(bathrooms !== undefined && { bathrooms: parseInt(bathrooms) }),
        ...(squareMeters !== undefined && { squareMeters: parseFloat(squareMeters) }),
        ...(rentAmount !== undefined && { rentAmount }),
        ...(additionalCharges !== undefined && { additionalCharges: JSON.stringify(additionalCharges) }),
        ...(paymentPeriod && { paymentPeriod }),
        ...(status && { status }),
      },
    });

    return ApiResponse.success(res, parseUnit(updated), 'Unit updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const unit = await prisma.unit.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!unit) throw ApiError.notFound('Unit not found');
    if (unit.status !== 'VACANT') throw ApiError.badRequest('Cannot delete an occupied or maintenance unit');

    await prisma.unit.delete({ where: { id: req.params.id } });

    return ApiResponse.success(res, null, 'Unit deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, update, remove, parseUnit };
