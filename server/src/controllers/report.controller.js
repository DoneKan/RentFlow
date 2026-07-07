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

async function dashboard(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      totalProperties,
      totalUnits,
      occupiedUnits,
      activeTenancies,
      monthlyPayments,
      overdueInvoices,
      recentPayments,
      pendingInvoices,
      monthlyExpenses,
    ] = await Promise.all([
      prisma.property.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.unit.count({ where: { property: { organizationId: orgId } } }),
      prisma.unit.count({ where: { property: { organizationId: orgId }, status: 'OCCUPIED' } }),
      prisma.tenancy.count({ where: { property: { organizationId: orgId }, status: 'ACTIVE' } }),
      prisma.payment.aggregate({
        where: {
          invoice: { property: { organizationId: orgId } },
          status: 'COMPLETED',
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { property: { organizationId: orgId }, status: 'OVERDUE' },
        include: {
          tenant: { select: { name: true, email: true } },
          unit: { select: { unitNumber: true } },
          property: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      prisma.payment.findMany({
        where: {
          invoice: { property: { organizationId: orgId } },
          status: 'COMPLETED',
        },
        include: {
          tenant: { select: { name: true } },
          invoice: {
            select: {
              invoiceNumber: true,
              unit: { select: { unitNumber: true } },
              property: { select: { name: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
        take: 8,
      }),
      prisma.invoice.count({
        where: { property: { organizationId: orgId }, status: { in: ['SENT', 'DRAFT'] } },
      }),
      prisma.expense.aggregate({
        where: {
          property: { organizationId: orgId },
          date: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const monthlyRevenue = Number(monthlyPayments._sum.amount || 0);
    const monthlyExpensesTotal = Number(monthlyExpenses._sum.amount || 0);
    const netIncome = monthlyRevenue - monthlyExpensesTotal;

    return ApiResponse.success(res, {
      properties: { total: totalProperties },
      units: { total: totalUnits, occupied: occupiedUnits, vacant: totalUnits - occupiedUnits, occupancyRate },
      tenants: { active: activeTenancies },
      financials: {
        monthlyRevenue,
        monthlyExpenses: monthlyExpensesTotal,
        netIncome,
        paymentsThisMonth: monthlyPayments._count,
      },
      invoices: { overdue: overdueInvoices.length, pending: pendingInvoices },
      overdueInvoices,
      recentPayments,
    });
  } catch (err) {
    next(err);
  }
}

async function monthly(req, res, next) {
  try {
    const { month, year } = req.query;
    const orgId = req.user.organizationId;

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();

    const start = startOfMonth(y, m);
    const end = endOfMonth(y, m);

    const [revenue, outstanding, expenses, propertySummaries] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          invoice: { property: { organizationId: orgId } },
          status: 'COMPLETED',
          paidAt: { gte: start, lte: end },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.aggregate({
        where: {
          property: { organizationId: orgId },
          status: { in: ['SENT', 'OVERDUE'] },
          dueDate: { lte: end },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: {
          property: { organizationId: orgId },
          date: { gte: start, lte: end },
        },
        _sum: { amount: true },
      }),
      prisma.property.findMany({
        where: { organizationId: orgId, isActive: true },
        include: {
          units: { select: { status: true } },
          invoices: {
            where: {
              status: 'PAID',
              paidAt: { gte: start, lte: end },
            },
            include: { payments: { where: { status: 'COMPLETED' } } },
          },
          expenses: {
            where: { date: { gte: start, lte: end } },
          },
        },
      }),
    ]);

    const summaries = propertySummaries.map((prop) => {
      const totalUnits = prop.units.length;
      const occupied = prop.units.filter((u) => u.status === 'OCCUPIED').length;
      const propRevenue = prop.invoices.reduce((sum, inv) => {
        return sum + inv.payments.reduce((s, p) => s + Number(p.amount), 0);
      }, 0);
      const propExpenses = prop.expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      return {
        propertyId: prop.id,
        propertyName: prop.name,
        propertyCode: prop.code,
        totalUnits,
        occupiedUnits: occupied,
        occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
        revenue: propRevenue,
        expenses: propExpenses,
        netIncome: propRevenue - propExpenses,
      };
    });

    const totalRevenue = Number(revenue._sum.amount || 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e._sum.amount), 0);

    return ApiResponse.success(res, {
      period: { month: m, year: y, label: `${new Date(y, m - 1).toLocaleString('en-UG', { month: 'long' })} ${y}` },
      revenue: { total: totalRevenue, count: revenue._count },
      outstanding: { total: Number(outstanding._sum.amount || 0), count: outstanding._count },
      expenses: {
        total: totalExpenses,
        breakdown: expenses.map((e) => ({ category: e.category, amount: Number(e._sum.amount) })),
      },
      netIncome: totalRevenue - totalExpenses,
      properties: summaries,
    });
  } catch (err) {
    next(err);
  }
}

async function propertyReport(req, res, next) {
  try {
    const { id } = req.params;
    const { month, year } = req.query;

    const property = await prisma.property.findFirst({
      where: { id, organizationId: req.user.organizationId },
    });
    if (!property) throw ApiError.notFound('Property not found');

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const start = startOfMonth(y, m);
    const end = endOfMonth(y, m);

    const [units, invoices, expenses, payments] = await Promise.all([
      prisma.unit.findMany({
        where: { propertyId: id },
        include: {
          tenancy: {
            where: { status: 'ACTIVE' },
            include: { tenant: { select: { name: true, email: true, phone: true } } },
          },
        },
      }),
      prisma.invoice.findMany({
        where: { propertyId: id, dueDate: { gte: start, lte: end } },
        include: {
          tenant: { select: { name: true } },
          unit: { select: { unitNumber: true } },
          payments: { where: { status: 'COMPLETED' } },
        },
      }),
      prisma.expense.findMany({
        where: { propertyId: id, date: { gte: start, lte: end } },
        orderBy: { date: 'desc' },
      }),
      prisma.payment.findMany({
        where: {
          invoice: { propertyId: id },
          status: 'COMPLETED',
          paidAt: { gte: start, lte: end },
        },
        include: {
          tenant: { select: { name: true } },
          invoice: { select: { invoiceNumber: true } },
        },
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    return ApiResponse.success(res, {
      property: { id: property.id, name: property.name, code: property.code },
      period: { month: m, year: y },
      units: {
        total: units.length,
        occupied: units.filter((u) => u.status === 'OCCUPIED').length,
        vacant: units.filter((u) => u.status === 'VACANT').length,
        details: units,
      },
      invoices,
      expenses,
      payments,
      summary: {
        revenue: totalRevenue,
        expenses: totalExpenses,
        netIncome: totalRevenue - totalExpenses,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function exportReport(req, res, next) {
  try {
    const { type = 'monthly', month, year, propertyId } = req.query;
    const orgId = req.user.organizationId;

    const m = parseInt(month) || new Date().getMonth() + 1;
    const y = parseInt(year) || new Date().getFullYear();
    const start = startOfMonth(y, m);
    const end = endOfMonth(y, m);

    const payments = await prisma.payment.findMany({
      where: {
        invoice: {
          property: { organizationId: orgId, ...(propertyId && { id: propertyId }) },
        },
        status: 'COMPLETED',
        paidAt: { gte: start, lte: end },
      },
      include: {
        tenant: { select: { name: true, email: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            unit: { select: { unitNumber: true } },
            property: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    const rows = [
      ['Receipt No', 'Date', 'Tenant', 'Property', 'Unit', 'Invoice', 'Amount', 'Method'].join(','),
      ...payments.map((p) =>
        [
          p.receiptNumber,
          p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-UG') : '',
          `"${p.tenant.name}"`,
          `"${p.invoice.property.name}"`,
          p.invoice.unit.unitNumber,
          p.invoice.invoiceNumber,
          Number(p.amount),
          p.method,
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rentflow-report-${y}-${String(m).padStart(2, '0')}.csv"`);
    res.send(rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, monthly, propertyReport, exportReport };
