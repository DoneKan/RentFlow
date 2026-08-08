const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generatePropertyCode } = require('../utils/generateCode');
const { attachCurrentTenancy } = require('../utils/tenancyHelpers');
const { getCompletedPaymentTotalsByProperty } = require('../utils/paymentAggregates');

const prisma = require('../utils/prisma');

// SQLite stores amenities as a JSON string — parse on read, stringify on write
function parseAmenities(p) {
  if (!p) return p;
  try {
    return { ...p, amenities: typeof p.amenities === 'string' ? JSON.parse(p.amenities) : (p.amenities || []) };
  } catch {
    return { ...p, amenities: [] };
  }
}

// Sums this calendar month's completed payments per property, aggregated
// at the database level (see paymentAggregates.js for why this needs a
// join rather than a plain Prisma groupBy).
async function getMonthlyRevenueByProperty(propertyIds) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return getCompletedPaymentTotalsByProperty(prisma, propertyIds, monthStart, monthEnd);
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { organizationId: req.user.organizationId, isActive: true };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        include: {
          manager: { select: { id: true, name: true, email: true, phone: true } },
          _count: { select: { units: true } },
          units: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.property.count({ where }),
    ]);

    const revenueByProperty = await getMonthlyRevenueByProperty(properties.map((p) => p.id));

    const enriched = properties.map((p) => {
      const totalUnits = p._count.units;
      const occupied = p.units.filter((u) => u.status === 'OCCUPIED').length;
      const occupancyRate = totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0;
      const { units, ...rest } = p;
      return parseAmenities({
        ...rest,
        totalUnits,
        occupiedUnits: occupied,
        occupancyRate,
        monthlyRevenue: revenueByProperty[p.id] || 0,
      });
    });

    return ApiResponse.paginated(res, enriched, {
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
    const { name, type, description, address, city, district, country, latitude, longitude, amenities } = req.body;

    const code = await generatePropertyCode(name);

    const property = await prisma.property.create({
      data: {
        code,
        name,
        type: type || 'RESIDENTIAL',
        description,
        address,
        city,
        district,
        country: country || 'UG',
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        amenities: JSON.stringify(amenities || []),
        managerId: req.user.id,
        organizationId: req.user.organizationId,
      },
      include: {
        manager: { select: { id: true, name: true, email: true } },
      },
    });

    return ApiResponse.created(res, parseAmenities(property), 'Property created successfully');
  } catch (err) {
    next(err);
  }
}

async function getVacant(req, res, next) {
  try {
    const { city, district } = req.query;

    const units = await prisma.unit.findMany({
      where: {
        status: 'VACANT',
        property: {
          isActive: true,
          organizationId: req.user.organizationId,
          ...(city && { city }),
          ...(district && { district }),
        },
      },
      include: {
        property: {
          include: {
            manager: { select: { name: true, phone: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const parsed = units.map((u) => ({ ...u, property: parseAmenities(u.property) }));
    return ApiResponse.success(res, parsed, 'Vacant units retrieved');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: {
        manager: { select: { id: true, name: true, email: true, phone: true } },
        units: {
          include: {
            tenancies: {
              include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
            },
          },
          orderBy: { unitNumber: 'asc' },
        },
        _count: { select: { units: true, expenses: true } },
      },
    });

    if (!property) throw ApiError.notFound('Property not found');

    const revenueByProperty = await getMonthlyRevenueByProperty([property.id]);

    return ApiResponse.success(res, parseAmenities({
      ...property,
      units: property.units.map(attachCurrentTenancy),
      monthlyRevenue: revenueByProperty[property.id] || 0,
    }));
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Property not found');

    const { name, type, description, address, city, district, country, latitude, longitude, amenities, isActive } = req.body;

    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(description !== undefined && { description }),
        ...(address && { address }),
        ...(city && { city }),
        ...(district !== undefined && { district }),
        ...(country && { country }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(amenities !== undefined && { amenities: JSON.stringify(amenities) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return ApiResponse.success(res, parseAmenities(property), 'Property updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.property.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Property not found');

    await prisma.property.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    return ApiResponse.success(res, null, 'Property deactivated');
  } catch (err) {
    next(err);
  }
}

async function getUnits(req, res, next) {
  try {
    const property = await prisma.property.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!property) throw ApiError.notFound('Property not found');

    const units = await prisma.unit.findMany({
      where: { propertyId: req.params.id },
      include: {
        tenancies: {
          include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
        },
      },
      orderBy: { unitNumber: 'asc' },
    });

    return ApiResponse.success(res, units.map(attachCurrentTenancy));
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getVacant, getOne, update, remove, getUnits };
