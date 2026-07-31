const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

function startOfMonth(year, month) {
  return new Date(year, month - 1, 1);
}

function endOfMonth(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

async function getMyPortal(req, res, next) {
  try {
    const now = new Date();
    const monthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);
    const monthEnd = endOfMonth(now.getFullYear(), now.getMonth() + 1);

    const properties = await prisma.property.findMany({
      where: { ownerId: req.user.id, isActive: true },
      include: {
        units: { select: { id: true, unitNumber: true, status: true, rentAmount: true } },
        organization: { select: { name: true, currency: true } },
      },
      orderBy: { name: 'asc' },
    });

    if (properties.length === 0) {
      return ApiResponse.success(res, {
        properties: [],
        summary: { totalProperties: 0, totalUnits: 0, occupiedUnits: 0, occupancyRate: 0, monthlyRevenue: 0, monthlyExpenses: 0, netIncome: 0 },
        recentPayments: [],
      });
    }

    const propertyIds = properties.map((p) => p.id);

    const [monthlyPayments, monthlyExpenses, recentPayments] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          invoice: { propertyId: { in: propertyIds } },
          status: 'COMPLETED',
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { propertyId: { in: propertyIds }, date: { gte: monthStart, lte: monthEnd } },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { invoice: { propertyId: { in: propertyIds } }, status: 'COMPLETED' },
        include: {
          tenant: { select: { name: true } },
          invoice: { select: { invoiceNumber: true, property: { select: { name: true } }, unit: { select: { unitNumber: true } } } },
        },
        orderBy: { paidAt: 'desc' },
        take: 10,
      }),
    ]);

    const totalUnits = properties.reduce((s, p) => s + p.units.length, 0);
    const occupiedUnits = properties.reduce((s, p) => s + p.units.filter((u) => u.status === 'OCCUPIED').length, 0);
    const revenue = Number(monthlyPayments._sum.amount || 0);
    const expenses = Number(monthlyExpenses._sum.amount || 0);

    return ApiResponse.success(res, {
      properties,
      summary: {
        totalProperties: properties.length,
        totalUnits,
        occupiedUnits,
        occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
        monthlyRevenue: revenue,
        monthlyExpenses: expenses,
        netIncome: revenue - expenses,
      },
      recentPayments,
    });
  } catch (err) {
    next(err);
  }
}

async function getPropertyStatement(req, res, next) {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    const property = await prisma.property.findFirst({
      where: { id, ownerId: req.user.id },
    });
    if (!property) throw ApiError.notFound('Property not found');

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const start = startOfMonth(y, m);
    const end = endOfMonth(y, m);

    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({
        where: { invoice: { propertyId: id }, status: 'COMPLETED', paidAt: { gte: start, lte: end } },
        include: { tenant: { select: { name: true } }, invoice: { select: { invoiceNumber: true, unit: { select: { unitNumber: true } } } } },
        orderBy: { paidAt: 'asc' },
      }),
      prisma.expense.findMany({
        where: { propertyId: id, date: { gte: start, lte: end } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return ApiResponse.success(res, {
      property: { id: property.id, name: property.name, code: property.code },
      period: { month: m, year: y },
      payments,
      expenses,
      summary: { revenue, expenses: expensesTotal, netIncome: revenue - expensesTotal },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMyPortal, getPropertyStatement };
