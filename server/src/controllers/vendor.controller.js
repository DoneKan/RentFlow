const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, category, isActive } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      organizationId: req.user.organizationId,
      ...(category && { category }),
      ...(isActive !== undefined && { isActive: isActive === 'true' }),
    };

    const [vendors, total] = await Promise.all([
      prisma.vendor.findMany({
        where,
        include: { _count: { select: { maintenanceRequests: true } } },
        orderBy: { name: 'asc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.vendor.count({ where }),
    ]);

    return ApiResponse.paginated(res, vendors, {
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!vendor) throw ApiError.notFound('Vendor not found');
    return ApiResponse.success(res, vendor);
  } catch (err) {
    next(err);
  }
}

async function getHistory(req, res, next) {
  try {
    const vendor = await prisma.vendor.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!vendor) throw ApiError.notFound('Vendor not found');

    const requests = await prisma.maintenanceRequest.findMany({
      where: { vendorId: vendor.id },
      include: {
        property: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
      },
      orderBy: { assignedAt: 'desc' },
    });

    return ApiResponse.success(res, requests);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, category, phone, email, address, notes } = req.body;

    const vendor = await prisma.vendor.create({
      data: {
        organizationId: req.user.organizationId,
        name,
        category: category || 'GENERAL',
        phone,
        email,
        address,
        notes,
      },
    });

    return ApiResponse.created(res, vendor, 'Vendor added');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.vendor.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Vendor not found');

    const { name, category, phone, email, address, notes, isActive } = req.body;

    const vendor = await prisma.vendor.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return ApiResponse.success(res, vendor, 'Vendor updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.vendor.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Vendor not found');

    await prisma.vendor.delete({ where: { id: req.params.id } });

    return ApiResponse.success(res, null, 'Vendor deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, getHistory, create, update, remove };
