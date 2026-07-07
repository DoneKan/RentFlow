const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, propertyId, category, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      property: { organizationId: req.user.organizationId },
      ...(propertyId && { propertyId }),
      ...(category && { category }),
      ...(startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      },
    };

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          property: { select: { id: true, name: true, code: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.expense.count({ where }),
    ]);

    return ApiResponse.paginated(res, expenses, {
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function summary(req, res, next) {
  try {
    const { propertyId, startDate, endDate } = req.query;

    const where = {
      property: { organizationId: req.user.organizationId },
      ...(propertyId && { propertyId }),
      ...(startDate || endDate) && {
        date: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) }),
        },
      },
    };

    const raw = await prisma.expense.groupBy({
      by: ['category', 'propertyId'],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const propertyIds = [...new Set(raw.map((r) => r.propertyId))];
    const properties = await prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true, code: true },
    });

    const propMap = Object.fromEntries(properties.map((p) => [p.id, p]));

    const result = raw.map((r) => ({
      propertyId: r.propertyId,
      property: propMap[r.propertyId],
      category: r.category,
      total: Number(r._sum.amount),
      count: r._count,
    }));

    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { propertyId, category, amount, description, date, vendor } = req.body;

    const property = await prisma.property.findFirst({
      where: { id: propertyId, organizationId: req.user.organizationId },
    });
    if (!property) throw ApiError.notFound('Property not found');

    const expense = await prisma.expense.create({
      data: {
        propertyId,
        category: category || 'OTHER',
        amount,
        description,
        date: new Date(date),
        vendor,
        receiptUrl: req.file ? `/uploads/${req.file.filename}` : undefined,
      },
      include: { property: { select: { id: true, name: true } } },
    });

    return ApiResponse.created(res, expense, 'Expense logged');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
      include: { property: { select: { id: true, name: true, code: true } } },
    });
    if (!expense) throw ApiError.notFound('Expense not found');

    return ApiResponse.success(res, expense);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!existing) throw ApiError.notFound('Expense not found');

    const { category, amount, description, date, vendor } = req.body;

    const updated = await prisma.expense.update({
      where: { id: req.params.id },
      data: {
        ...(category && { category }),
        ...(amount !== undefined && { amount }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(vendor !== undefined && { vendor }),
        ...(req.file && { receiptUrl: `/uploads/${req.file.filename}` }),
      },
    });

    return ApiResponse.success(res, updated, 'Expense updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!existing) throw ApiError.notFound('Expense not found');

    await prisma.expense.delete({ where: { id: req.params.id } });

    return ApiResponse.success(res, null, 'Expense deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, summary, create, getOne, update, remove };
