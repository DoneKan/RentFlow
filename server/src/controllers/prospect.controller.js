const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = require('../utils/prisma');

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, stage, propertyId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      organizationId: req.user.organizationId,
      ...(stage && { stage }),
      ...(propertyId && { propertyId }),
    };

    const [prospects, total] = await Promise.all([
      prisma.prospect.findMany({
        where,
        include: { property: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.prospect.count({ where }),
    ]);

    return ApiResponse.paginated(res, prospects, {
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const prospect = await prisma.prospect.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { property: { select: { id: true, name: true, code: true } } },
    });
    if (!prospect) throw ApiError.notFound('Prospect not found');
    return ApiResponse.success(res, prospect);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, phone, email, source, propertyId, unitId, showingDate, notes } = req.body;

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId: req.user.organizationId },
      });
      if (!property) throw ApiError.notFound('Property not found');
    }

    const prospect = await prisma.prospect.create({
      data: {
        organizationId: req.user.organizationId,
        name,
        phone,
        email,
        source: source || 'OTHER',
        propertyId,
        unitId,
        showingDate: showingDate ? new Date(showingDate) : undefined,
        notes,
      },
      include: { property: { select: { id: true, name: true } } },
    });

    return ApiResponse.created(res, prospect, 'Prospect added');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.prospect.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Prospect not found');

    const { name, phone, email, source, propertyId, unitId, showingDate, notes } = req.body;

    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(source !== undefined && { source }),
        ...(propertyId !== undefined && { propertyId }),
        ...(unitId !== undefined && { unitId }),
        ...(showingDate !== undefined && { showingDate: showingDate ? new Date(showingDate) : null }),
        ...(notes !== undefined && { notes }),
      },
    });

    return ApiResponse.success(res, prospect, 'Prospect updated');
  } catch (err) {
    next(err);
  }
}

async function updateStage(req, res, next) {
  try {
    const { stage } = req.body;

    const existing = await prisma.prospect.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Prospect not found');

    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: { stage },
    });

    return ApiResponse.success(res, prospect, 'Stage updated');
  } catch (err) {
    next(err);
  }
}

async function updateScreening(req, res, next) {
  try {
    const {
      idNumber, employerName, monthlyIncome, previousLandlordName, previousLandlordPhone,
      references, screeningStatus, screeningNotes,
    } = req.body;

    const existing = await prisma.prospect.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Prospect not found');

    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: {
        ...(idNumber !== undefined && { idNumber }),
        ...(employerName !== undefined && { employerName }),
        ...(monthlyIncome !== undefined && { monthlyIncome }),
        ...(previousLandlordName !== undefined && { previousLandlordName }),
        ...(previousLandlordPhone !== undefined && { previousLandlordPhone }),
        ...(references !== undefined && { references: JSON.stringify(references) }),
        ...(screeningStatus !== undefined && {
          screeningStatus,
          screenedById: req.user.id,
          screenedAt: new Date(),
        }),
        ...(screeningNotes !== undefined && { screeningNotes }),
        ...(screeningStatus === 'APPROVED' && { stage: 'APPROVED' }),
        ...(screeningStatus === 'REJECTED' && { stage: 'REJECTED' }),
      },
    });

    return ApiResponse.success(res, prospect, 'Screening updated');
  } catch (err) {
    next(err);
  }
}

async function markConverted(req, res, next) {
  try {
    const { tenancyId } = req.body;

    const existing = await prisma.prospect.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Prospect not found');

    const prospect = await prisma.prospect.update({
      where: { id: req.params.id },
      data: { stage: 'CONVERTED', convertedTenancyId: tenancyId },
    });

    return ApiResponse.success(res, prospect, 'Prospect converted to tenancy');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.prospect.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Prospect not found');

    await prisma.prospect.delete({ where: { id: req.params.id } });

    return ApiResponse.success(res, null, 'Prospect removed');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, updateStage, updateScreening, markConverted, remove };
