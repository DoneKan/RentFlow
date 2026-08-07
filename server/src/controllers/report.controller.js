const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { syncOverdueStatuses } = require('../jobs/invoiceJob');
const { attachCurrentTenancy } = require('../utils/tenancyHelpers');

const prisma = require('../utils/prisma');

function startOfMonth(year, month) {
  return new Date(year, month - 1, 1);
}

function endOfMonth(year, month) {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

// Resolves a query into a concrete { start, end } date range.
// Accepts either an explicit startDate/endDate pair, or a month/year pair
// (kept for backward compatibility), defaulting to the current month.
function resolveRange(query) {
  const { startDate, endDate, month, year } = query;

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const m = parseInt(month) || new Date().getMonth() + 1;
  const y = parseInt(year) || new Date().getFullYear();
  return { start: startOfMonth(y, m), end: endOfMonth(y, m) };
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function dashboard(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const { propertyId } = req.query;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    await syncOverdueStatuses(orgId);

    const propertyFilter = propertyId ? { propertyId } : {};

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
      propertyId
        ? prisma.property.count({ where: { organizationId: orgId, isActive: true, id: propertyId } })
        : prisma.property.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.unit.count({ where: { property: { organizationId: orgId }, ...propertyFilter } }),
      prisma.unit.count({ where: { property: { organizationId: orgId }, status: 'OCCUPIED', ...propertyFilter } }),
      prisma.tenancy.count({ where: { property: { organizationId: orgId }, status: 'ACTIVE', ...propertyFilter } }),
      prisma.payment.aggregate({
        where: {
          invoice: { property: { organizationId: orgId }, ...propertyFilter },
          status: 'COMPLETED',
          paidAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.invoice.findMany({
        where: { property: { organizationId: orgId }, status: 'OVERDUE', ...propertyFilter },
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
          invoice: { property: { organizationId: orgId }, ...propertyFilter },
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
        where: { property: { organizationId: orgId }, status: { in: ['SENT', 'DRAFT'] }, ...propertyFilter },
      }),
      prisma.expense.aggregate({
        where: {
          property: { organizationId: orgId },
          date: { gte: monthStart, lte: monthEnd },
          ...propertyFilter,
        },
        _sum: { amount: true },
      }),
    ]);

    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const monthlyRevenue = Number(monthlyPayments._sum.amount || 0);
    const monthlyExpensesTotal = Number(monthlyExpenses._sum.amount || 0);
    const netIncome = monthlyRevenue - monthlyExpensesTotal;

    // Reuse the same overview computation the Reports page uses, for the
    // true outstanding balance (not just the 10 overdue invoices shown here)
    // and the 6-month revenue/expense trend.
    const overview = await computeOverview(orgId, monthStart, monthEnd, propertyId);

    return ApiResponse.success(res, {
      properties: { total: totalProperties },
      units: { total: totalUnits, occupied: occupiedUnits, vacant: totalUnits - occupiedUnits, occupancyRate },
      tenants: { active: activeTenancies },
      financials: {
        monthlyRevenue,
        monthlyExpenses: monthlyExpensesTotal,
        netIncome,
        paymentsThisMonth: monthlyPayments._count,
        outstanding: overview.outstanding.total,
      },
      invoices: { overdue: overdueInvoices.length, pending: pendingInvoices },
      overdueInvoices,
      recentPayments,
      trend: overview.trend,
    });
  } catch (err) {
    next(err);
  }
}

// Core data for the "Overall" financial report: totals, expense category
// split, outstanding/collection metrics, and a trailing 6-month trend.
// `propertyId`, when given, scopes every figure to that one property —
// used by the Dashboard's property filter.
async function computeOverview(orgId, start, end, propertyId) {
  const propertyFilter = propertyId ? { propertyId } : {};
  const [revenueAgg, expensesByCategory, outstandingAgg, invoicedAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: {
        invoice: { property: { organizationId: orgId }, ...propertyFilter },
        status: 'COMPLETED',
        paidAt: { gte: start, lte: end },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { property: { organizationId: orgId }, date: { gte: start, lte: end }, ...propertyFilter },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: {
        property: { organizationId: orgId },
        status: { in: ['SENT', 'OVERDUE'] },
        dueDate: { lte: end },
        ...propertyFilter,
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: { property: { organizationId: orgId }, dueDate: { gte: start, lte: end }, ...propertyFilter },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const revenue = Number(revenueAgg._sum.amount || 0);
  const expensesTotal = expensesByCategory.reduce((s, e) => s + Number(e._sum.amount || 0), 0);
  const outstanding = Number(outstandingAgg._sum.amount || 0);
  const invoicedTotal = Number(invoicedAgg._sum.amount || 0);
  const netIncome = revenue - expensesTotal;
  const collectionRate = invoicedTotal > 0 ? Math.round((revenue / invoicedTotal) * 100) : (revenue > 0 ? 100 : 0);

  // Trend window is always the trailing 6 months ending in the selected
  // range's end month, independent of how wide the selected range itself is.
  const trendStartMonth = new Date(end.getFullYear(), end.getMonth() - 5, 1);
  const trendEnd = endOfMonth(end.getFullYear(), end.getMonth() + 1);

  const [trendPayments, trendExpenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        invoice: { property: { organizationId: orgId }, ...propertyFilter },
        status: 'COMPLETED',
        paidAt: { gte: trendStartMonth, lte: trendEnd },
      },
      select: { amount: true, paidAt: true },
    }),
    prisma.expense.findMany({
      where: { property: { organizationId: orgId }, date: { gte: trendStartMonth, lte: trendEnd }, ...propertyFilter },
      select: { amount: true, date: true },
    }),
  ]);

  const revMap = {};
  trendPayments.forEach((p) => {
    const key = monthKey(p.paidAt);
    revMap[key] = (revMap[key] || 0) + Number(p.amount);
  });
  const expMap = {};
  trendExpenses.forEach((e) => {
    const key = monthKey(e.date);
    expMap[key] = (expMap[key] || 0) + Number(e.amount);
  });

  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(trendStartMonth.getFullYear(), trendStartMonth.getMonth() + i, 1);
    const key = monthKey(d);
    const rev = revMap[key] || 0;
    const exp = expMap[key] || 0;
    return {
      month: d.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      revenue: rev,
      expenses: exp,
      netIncome: rev - exp,
    };
  });

  return {
    range: { startDate: start, endDate: end },
    revenue: { total: revenue, count: revenueAgg._count },
    expenses: {
      total: expensesTotal,
      byCategory: expensesByCategory
        .map((e) => ({ category: e.category, amount: Number(e._sum.amount || 0), count: e._count }))
        .sort((a, b) => b.amount - a.amount),
    },
    outstanding: { total: outstanding, count: outstandingAgg._count },
    invoiced: { total: invoicedTotal, count: invoicedAgg._count },
    netIncome,
    collectionRate,
    trend,
  };
}

// Core data for the "By Property" report: revenue/expenses/occupancy per
// property so a landlord can see which buildings are actually profitable.
async function computeByProperty(orgId, start, end) {
  const [properties, outstandingByProperty] = await Promise.all([
    prisma.property.findMany({
      where: { organizationId: orgId, isActive: true },
      include: {
        units: { select: { status: true } },
        invoices: {
          where: { dueDate: { gte: start, lte: end } },
          select: {
            amount: true,
            status: true,
            payments: {
              where: { status: 'COMPLETED', paidAt: { gte: start, lte: end } },
              select: { amount: true },
            },
          },
        },
        expenses: {
          where: { date: { gte: start, lte: end } },
          select: { amount: true, category: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Cumulative-to-date unpaid balance per property, matching
    // computeOverview's outstanding definition — not scoped to invoices
    // raised within the selected window, so it doesn't miss earlier
    // unpaid invoices that are still owed.
    prisma.invoice.groupBy({
      by: ['propertyId'],
      where: {
        property: { organizationId: orgId, isActive: true },
        status: { in: ['SENT', 'OVERDUE'] },
        dueDate: { lte: end },
      },
      _sum: { amount: true },
    }),
  ]);

  const outstandingMap = Object.fromEntries(
    outstandingByProperty.map((r) => [r.propertyId, Number(r._sum.amount || 0)])
  );

  const rows = properties
    .map((prop) => {
      const totalUnits = prop.units.length;
      const occupied = prop.units.filter((u) => u.status === 'OCCUPIED').length;

      const revenue = prop.invoices.reduce(
        (sum, inv) => sum + inv.payments.reduce((s, p) => s + Number(p.amount), 0),
        0
      );
      const outstanding = outstandingMap[prop.id] || 0;

      const expensesByCategory = {};
      prop.expenses.forEach((e) => {
        expensesByCategory[e.category] = (expensesByCategory[e.category] || 0) + Number(e.amount);
      });
      const expensesTotal = prop.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const topCategoryEntry = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0];

      const netIncome = revenue - expensesTotal;

      return {
        propertyId: prop.id,
        propertyName: prop.name,
        propertyCode: prop.code,
        totalUnits,
        occupiedUnits: occupied,
        occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
        invoicesRaised: prop.invoices.length,
        revenue,
        expenses: expensesTotal,
        expensesByCategory,
        topExpenseCategory: topCategoryEntry ? { category: topCategoryEntry[0], amount: topCategoryEntry[1] } : null,
        outstanding,
        netIncome,
        margin: revenue > 0 ? Math.round((netIncome / revenue) * 100) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      expenses: acc.expenses + r.expenses,
      outstanding: acc.outstanding + r.outstanding,
      netIncome: acc.netIncome + r.netIncome,
      totalUnits: acc.totalUnits + r.totalUnits,
      occupiedUnits: acc.occupiedUnits + r.occupiedUnits,
      invoicesRaised: acc.invoicesRaised + r.invoicesRaised,
    }),
    { revenue: 0, expenses: 0, outstanding: 0, netIncome: 0, totalUnits: 0, occupiedUnits: 0, invoicesRaised: 0 }
  );

  return {
    range: { startDate: start, endDate: end },
    properties: rows,
    totals: {
      ...totals,
      occupancyRate: totals.totalUnits > 0 ? Math.round((totals.occupiedUnits / totals.totalUnits) * 100) : 0,
      margin: totals.revenue > 0 ? Math.round((totals.netIncome / totals.revenue) * 100) : 0,
    },
  };
}

async function financialOverview(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const { start, end } = resolveRange(req.query);
    const data = await computeOverview(orgId, start, end);
    return ApiResponse.success(res, data);
  } catch (err) {
    next(err);
  }
}

async function financialByProperty(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const { start, end } = resolveRange(req.query);
    const data = await computeByProperty(orgId, start, end);
    return ApiResponse.success(res, data);
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
          tenancies: {
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
        details: units.map(attachCurrentTenancy),
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

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

async function exportReport(req, res, next) {
  try {
    const { type = 'transactions', month, year, propertyId } = req.query;
    const orgId = req.user.organizationId;
    const { start, end } = resolveRange(req.query);
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    if (type === 'overall') {
      const data = await computeOverview(orgId, start, end);
      const rows = [
        ['RentFlow — Overall Financial Report'],
        [`Period: ${start.toLocaleDateString('en-UG')} to ${end.toLocaleDateString('en-UG')}`],
        [],
        ['Metric', 'Amount'],
        ['Revenue Collected', data.revenue.total],
        ['Total Invoiced', data.invoiced.total],
        ['Outstanding Balance', data.outstanding.total],
        ['Collection Rate (%)', data.collectionRate],
        ['Total Expenses', data.expenses.total],
        ['Net Income', data.netIncome],
        [],
        ['Expenses by Category', 'Amount', 'Count'],
        ...data.expenses.byCategory.map((e) => [e.category, e.amount, e.count]),
        [],
        ['6-Month Trend', 'Revenue', 'Expenses', 'Net Income'],
        ...data.trend.map((t) => [t.month, t.revenue, t.expenses, t.netIncome]),
      ];
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="rentflow-overall-report-${y}-${String(m).padStart(2, '0')}.csv"`);
      return res.send(csv);
    }

    if (type === 'by-property') {
      const data = await computeByProperty(orgId, start, end);
      const rows = [
        ['RentFlow — Financial Report by Property'],
        [`Period: ${start.toLocaleDateString('en-UG')} to ${end.toLocaleDateString('en-UG')}`],
        [],
        ['Property', 'Code', 'Units', 'Occupied', 'Occupancy %', 'Invoices Raised', 'Revenue', 'Expenses', 'Outstanding', 'Net Income', 'Margin %'],
        ...data.properties.map((p) => [
          p.propertyName, p.propertyCode, p.totalUnits, p.occupiedUnits, p.occupancyRate,
          p.invoicesRaised, p.revenue, p.expenses, p.outstanding, p.netIncome, p.margin,
        ]),
        [],
        [
          'TOTAL', '', data.totals.totalUnits, data.totals.occupiedUnits, data.totals.occupancyRate,
          data.totals.invoicesRaised, data.totals.revenue, data.totals.expenses, data.totals.outstanding,
          data.totals.netIncome, data.totals.margin,
        ],
      ];
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="rentflow-property-report-${y}-${String(m).padStart(2, '0')}.csv"`);
      return res.send(csv);
    }

    // Default: raw transaction (payment) listing for the period.
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
      ['Receipt No', 'Date', 'Tenant', 'Property', 'Unit', 'Invoice', 'Amount', 'Method'],
      ...payments.map((p) => [
        p.receiptNumber,
        p.paidAt ? new Date(p.paidAt).toLocaleDateString('en-UG') : '',
        p.tenant.name,
        p.invoice.property.name,
        p.invoice.unit.unitNumber,
        p.invoice.invoiceNumber,
        Number(p.amount),
        p.method,
      ]),
    ];

    const csv = toCsv(rows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rentflow-transactions-${y}-${String(m).padStart(2, '0')}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

const PLAN_LIMITS = {
  FREE:       { units: 5,   properties: 1,  label: 'Starter' },
  STARTER:    { units: 5,   properties: 1,  label: 'Starter' },
  GROWTH:     { units: 30,  properties: 10, label: 'Growth' },
  BUSINESS:   { units: 100, properties: 50, label: 'Business' },
  ENTERPRISE: { units: Infinity, properties: Infinity, label: 'Enterprise' },
  PREMIUM:    { units: Infinity, properties: Infinity, label: 'Enterprise' },
};

async function subscription(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });

    const [totalUnits, totalProperties, activeTenancies] = await Promise.all([
      prisma.unit.count({ where: { property: { organizationId: orgId } } }),
      prisma.property.count({ where: { organizationId: orgId, isActive: true } }),
      prisma.tenancy.count({ where: { property: { organizationId: orgId }, status: 'ACTIVE' } }),
    ]);

    const plan = org.plan || 'FREE';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE;

    return ApiResponse.success(res, {
      plan,
      planLabel: limits.label,
      planExpiresAt: org.planExpiresAt,
      usage: {
        units: totalUnits,
        unitLimit: limits.units,
        properties: totalProperties,
        propertyLimit: limits.properties,
        activeTenancies,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboard,
  financialOverview,
  financialByProperty,
  propertyReport,
  exportReport,
  subscription,
};
