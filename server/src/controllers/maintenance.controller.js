const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, propertyId, status, priority } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const isTenant = req.user.role === 'TENANT';

    const where = {
      ...(isTenant
        ? { tenantId: req.user.id }
        : { property: { organizationId: req.user.organizationId } }),
      ...(propertyId && { propertyId }),
      ...(status && { status }),
      ...(priority && { priority }),
    };

    const [requests, total] = await Promise.all([
      prisma.maintenanceRequest.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, email: true, phone: true } },
          unit: { select: { id: true, unitNumber: true, type: true } },
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.maintenanceRequest.count({ where }),
    ]);

    return ApiResponse.paginated(res, requests, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const { id } = req.params;
    const isTenant = req.user.role === 'TENANT';

    const request = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        unit: { select: { id: true, unitNumber: true, type: true } },
        property: { select: { id: true, name: true, code: true } },
        tenancy: { select: { id: true, startDate: true, rentAmount: true } },
      },
    });

    if (!request) throw ApiError.notFound('Maintenance request not found');
    if (isTenant && request.tenantId !== req.user.id) throw ApiError.forbidden();
    if (!isTenant && request.property.organizationId !== req.user.organizationId) throw ApiError.forbidden();

    return ApiResponse.success(res, request);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { title, description, priority = 'MEDIUM' } = req.body;
    const isTenant = req.user.role === 'TENANT';

    if (!title || !description) throw ApiError.badRequest('Title and description are required');

    let tenancy;
    if (isTenant) {
      tenancy = await prisma.tenancy.findFirst({
        where: { tenantId: req.user.id, status: 'ACTIVE' },
      });
      if (!tenancy) throw ApiError.badRequest('No active tenancy found');
    } else {
      const { tenancyId } = req.body;
      if (!tenancyId) throw ApiError.badRequest('tenancyId is required');
      tenancy = await prisma.tenancy.findUnique({ where: { id: tenancyId } });
      if (!tenancy) throw ApiError.notFound('Tenancy not found');
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        tenancyId: tenancy.id,
        unitId: tenancy.unitId,
        propertyId: tenancy.propertyId,
        tenantId: tenancy.tenantId,
        title,
        description,
        priority,
        status: 'OPEN',
      },
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return ApiResponse.created(res, request, 'Maintenance request submitted');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { id } = req.params;
    const { status, priority, title, description } = req.body;
    const isTenant = req.user.role === 'TENANT';

    const existing = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { property: { select: { organizationId: true } } },
    });

    if (!existing) throw ApiError.notFound('Maintenance request not found');
    if (isTenant) {
      if (existing.tenantId !== req.user.id) throw ApiError.forbidden();
      // tenants can only cancel their own open requests
      if (status && status !== 'CANCELLED') throw ApiError.forbidden('Tenants can only cancel requests');
    } else {
      if (existing.property.organizationId !== req.user.organizationId) throw ApiError.forbidden();
    }

    const data = {};
    if (title && !isTenant) data.title = title;
    if (description && !isTenant) data.description = description;
    if (priority && !isTenant) data.priority = priority;
    if (status) {
      data.status = status;
      if (status === 'RESOLVED') data.resolvedAt = new Date();
    }

    const request = await prisma.maintenanceRequest.update({
      where: { id },
      data,
      include: {
        tenant: { select: { id: true, name: true } },
        unit: { select: { id: true, unitNumber: true } },
        property: { select: { id: true, name: true } },
      },
    });

    return ApiResponse.success(res, request, 'Maintenance request updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const { id } = req.params;

    const existing = await prisma.maintenanceRequest.findUnique({
      where: { id },
      include: { property: { select: { organizationId: true } } },
    });

    if (!existing) throw ApiError.notFound('Maintenance request not found');
    if (existing.property.organizationId !== req.user.organizationId) throw ApiError.forbidden();

    await prisma.maintenanceRequest.delete({ where: { id } });

    return ApiResponse.success(res, null, 'Maintenance request deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
