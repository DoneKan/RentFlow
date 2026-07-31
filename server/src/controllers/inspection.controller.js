const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateInspectionReport } = require('../utils/pdfGenerator');

const prisma = new PrismaClient();

const detailInclude = {
  property: { select: { id: true, name: true, code: true } },
  items: { include: { photos: true }, orderBy: { createdAt: 'asc' } },
};

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, propertyId, status, type } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      organizationId: req.user.organizationId,
      ...(propertyId && { propertyId }),
      ...(status && { status }),
      ...(type && { type }),
    };

    const [inspections, total] = await Promise.all([
      prisma.inspection.findMany({
        where,
        include: {
          property: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.inspection.count({ where }),
    ]);

    return ApiResponse.paginated(res, inspections, {
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const inspection = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: detailInclude,
    });
    if (!inspection) throw ApiError.notFound('Inspection not found');
    return ApiResponse.success(res, inspection);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { propertyId, unitId, tenancyId, type, scheduledDate, overallNotes } = req.body;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId: req.user.organizationId },
    });
    if (!property) throw ApiError.notFound('Property not found');

    const inspection = await prisma.inspection.create({
      data: {
        organizationId: req.user.organizationId,
        propertyId,
        unitId,
        tenancyId,
        type: type || 'ROUTINE',
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        inspectorId: req.user.id,
        overallNotes,
      },
      include: detailInclude,
    });

    return ApiResponse.created(res, inspection, 'Inspection scheduled');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Inspection not found');

    const { scheduledDate, overallNotes, status } = req.body;

    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: {
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
        ...(overallNotes !== undefined && { overallNotes }),
        ...(status !== undefined && { status }),
      },
      include: detailInclude,
    });

    return ApiResponse.success(res, inspection, 'Inspection updated');
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const inspection = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!inspection) throw ApiError.notFound('Inspection not found');

    const { area, condition, notes } = req.body;

    const item = await prisma.inspectionItem.create({
      data: { inspectionId: inspection.id, area, condition: condition || 'GOOD', notes },
      include: { photos: true },
    });

    return ApiResponse.created(res, item, 'Checklist item added');
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const inspection = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!inspection) throw ApiError.notFound('Inspection not found');

    const item = await prisma.inspectionItem.findFirst({
      where: { id: req.params.itemId, inspectionId: inspection.id },
    });
    if (!item) throw ApiError.notFound('Checklist item not found');

    const { area, condition, notes } = req.body;

    const updated = await prisma.inspectionItem.update({
      where: { id: item.id },
      data: {
        ...(area !== undefined && { area }),
        ...(condition !== undefined && { condition }),
        ...(notes !== undefined && { notes }),
      },
      include: { photos: true },
    });

    return ApiResponse.success(res, updated, 'Checklist item updated');
  } catch (err) {
    next(err);
  }
}

async function addPhotos(req, res, next) {
  try {
    const inspection = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!inspection) throw ApiError.notFound('Inspection not found');

    const item = await prisma.inspectionItem.findFirst({
      where: { id: req.params.itemId, inspectionId: inspection.id },
    });
    if (!item) throw ApiError.notFound('Checklist item not found');

    const files = req.files || [];
    if (files.length === 0) throw ApiError.badRequest('No photos uploaded');

    const photos = await prisma.$transaction(
      files.map((file) =>
        prisma.inspectionPhoto.create({
          data: { inspectionItemId: item.id, url: `/uploads/${file.filename}` },
        })
      )
    );

    return ApiResponse.created(res, photos, 'Photos uploaded');
  } catch (err) {
    next(err);
  }
}

async function complete(req, res, next) {
  try {
    const existing = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Inspection not found');

    const { overallNotes } = req.body;

    const inspection = await prisma.inspection.update({
      where: { id: req.params.id },
      data: { status: 'COMPLETED', completedDate: new Date(), ...(overallNotes !== undefined && { overallNotes }) },
      include: detailInclude,
    });

    return ApiResponse.success(res, inspection, 'Inspection marked complete');
  } catch (err) {
    next(err);
  }
}

async function getReport(req, res, next) {
  try {
    const inspection = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: detailInclude,
    });
    if (!inspection) throw ApiError.notFound('Inspection not found');

    const pdfBuffer = await generateInspectionReport(inspection);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="inspection-${inspection.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.inspection.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Inspection not found');

    const items = await prisma.inspectionItem.findMany({ where: { inspectionId: existing.id }, select: { id: true } });
    const itemIds = items.map((i) => i.id);

    await prisma.$transaction([
      prisma.inspectionPhoto.deleteMany({ where: { inspectionItemId: { in: itemIds } } }),
      prisma.inspectionItem.deleteMany({ where: { inspectionId: existing.id } }),
      prisma.inspection.delete({ where: { id: existing.id } }),
    ]);

    return ApiResponse.success(res, null, 'Inspection deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, addItem, updateItem, addPhotos, complete, getReport, remove };
