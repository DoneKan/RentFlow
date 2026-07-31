const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { propertyId } = req.query;

    const budgets = await prisma.budget.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(propertyId && { propertyId }),
      },
      include: {
        property: { select: { id: true, name: true } },
        lines: true,
      },
      orderBy: { periodStart: 'desc' },
    });

    return ApiResponse.success(res, budgets);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { property: { select: { id: true, name: true } }, lines: true },
    });
    if (!budget) throw ApiError.notFound('Budget not found');
    return ApiResponse.success(res, budget);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { propertyId, name, periodStart, periodEnd, currency, lines = [] } = req.body;

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId: req.user.organizationId },
      });
      if (!property) throw ApiError.notFound('Property not found');
    }

    const budget = await prisma.budget.create({
      data: {
        organizationId: req.user.organizationId,
        propertyId: propertyId || undefined,
        name,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        currency: currency || 'UGX',
        lines: {
          create: lines.map((l) => ({ category: l.category, plannedAmount: l.plannedAmount, notes: l.notes })),
        },
      },
      include: { lines: true, property: { select: { id: true, name: true } } },
    });

    return ApiResponse.created(res, budget, 'Budget created');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Budget not found');

    const { name, periodStart, periodEnd, currency, lines } = req.body;

    const ops = [
      prisma.budget.update({
        where: { id: req.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(periodStart !== undefined && { periodStart: new Date(periodStart) }),
          ...(periodEnd !== undefined && { periodEnd: new Date(periodEnd) }),
          ...(currency !== undefined && { currency }),
        },
      }),
    ];

    if (Array.isArray(lines)) {
      ops.push(prisma.budgetLine.deleteMany({ where: { budgetId: req.params.id } }));
      lines.forEach((l) => {
        ops.push(prisma.budgetLine.create({
          data: { budgetId: req.params.id, category: l.category, plannedAmount: l.plannedAmount, notes: l.notes },
        }));
      });
    }

    await prisma.$transaction(ops);

    const budget = await prisma.budget.findUnique({
      where: { id: req.params.id },
      include: { lines: true, property: { select: { id: true, name: true } } },
    });

    return ApiResponse.success(res, budget, 'Budget updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.budget.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Budget not found');

    await prisma.$transaction([
      prisma.budgetLine.deleteMany({ where: { budgetId: req.params.id } }),
      prisma.budget.delete({ where: { id: req.params.id } }),
    ]);

    return ApiResponse.success(res, null, 'Budget deleted');
  } catch (err) {
    next(err);
  }
}

async function variance(req, res, next) {
  try {
    const budget = await prisma.budget.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { lines: true },
    });
    if (!budget) throw ApiError.notFound('Budget not found');

    const propertyScope = budget.propertyId
      ? { propertyId: budget.propertyId }
      : { property: { organizationId: req.user.organizationId } };

    const [expenseTotals, revenueAgg] = await Promise.all([
      prisma.expense.groupBy({
        by: ['category'],
        where: { ...propertyScope, date: { gte: budget.periodStart, lte: budget.periodEnd } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          invoice: budget.propertyId ? { propertyId: budget.propertyId } : { property: { organizationId: req.user.organizationId } },
          status: 'COMPLETED',
          paidAt: { gte: budget.periodStart, lte: budget.periodEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const actualByCategory = Object.fromEntries(expenseTotals.map((e) => [e.category, Number(e._sum.amount || 0)]));
    actualByCategory.RENTAL_INCOME = Number(revenueAgg._sum.amount || 0);

    const lines = budget.lines.map((l) => {
      const actual = actualByCategory[l.category] || 0;
      const planned = Number(l.plannedAmount);
      const variance = l.category === 'RENTAL_INCOME' ? actual - planned : planned - actual;
      return {
        category: l.category,
        plannedAmount: planned,
        actual,
        variance,
        variancePercent: planned > 0 ? Math.round((variance / planned) * 100) : 0,
        notes: l.notes,
      };
    });

    const totals = lines.reduce(
      (acc, l) => ({
        plannedAmount: acc.plannedAmount + (l.category === 'RENTAL_INCOME' ? 0 : l.plannedAmount),
        actual: acc.actual + (l.category === 'RENTAL_INCOME' ? 0 : l.actual),
        plannedIncome: acc.plannedIncome + (l.category === 'RENTAL_INCOME' ? l.plannedAmount : 0),
        actualIncome: acc.actualIncome + (l.category === 'RENTAL_INCOME' ? l.actual : 0),
      }),
      { plannedAmount: 0, actual: 0, plannedIncome: 0, actualIncome: 0 }
    );

    return ApiResponse.success(res, {
      budget: { id: budget.id, name: budget.name, periodStart: budget.periodStart, periodEnd: budget.periodEnd, currency: budget.currency },
      lines,
      totals: {
        ...totals,
        plannedNet: totals.plannedIncome - totals.plannedAmount,
        actualNet: totals.actualIncome - totals.actual,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove, variance };
