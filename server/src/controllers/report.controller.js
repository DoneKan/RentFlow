const ExcelJS = require('exceljs');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { syncOverdueStatuses } = require('../jobs/invoiceJob');
const { attachCurrentTenancy, applyTenantDisplayAll } = require('../utils/tenancyHelpers');
const { getCompletedPaymentTotalsByProperty, getOutstandingBalance, getOutstandingBalanceByProperty } = require('../utils/paymentAggregates');

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
          tenancy: { select: { tenantName: true, tenantPhone: true } },
          unit: { select: { unitNumber: true } },
          property: { select: { name: true } },
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
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
              tenancy: { select: { tenantName: true, tenantPhone: true } },
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

    applyTenantDisplayAll(overdueInvoices);
    applyTenantDisplayAll(recentPayments, 'invoice.tenancy');

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
  const [revenueAgg, expensesByCategory, outstandingBalance, invoicedAgg] = await Promise.all([
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
    getOutstandingBalance(prisma, { organizationId: orgId, dueDateLte: end, propertyId }),
    prisma.invoice.aggregate({
      where: { property: { organizationId: orgId }, dueDate: { gte: start, lte: end }, ...propertyFilter },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  const revenue = Number(revenueAgg._sum.amount || 0);
  const expensesTotal = expensesByCategory.reduce((s, e) => s + Number(e._sum.amount || 0), 0);
  const outstanding = outstandingBalance.total;
  const invoicedTotal = Number(invoicedAgg._sum.amount || 0);
  const netIncome = revenue - expensesTotal;
  const collectionRate = invoicedTotal > 0 ? Math.round((revenue / invoicedTotal) * 100) : (revenue > 0 ? 100 : 0);

  // Trend window is always the trailing 6 months ending in the selected
  // range's end month, independent of how wide the selected range itself is
  // — capped at the current month, since a range like "All Years" resolves
  // to a far-future end date and would otherwise anchor the trend on
  // months that haven't happened yet (e.g. trailing from Dec 2100).
  // One SUM per month per metric (12 small aggregate queries) instead of
  // pulling every payment/expense row in the whole 6-month window and
  // summing them in JS — Prisma's groupBy can't bucket by a computed
  // month expression portably across Postgres/SQLite, but a fixed 6-month
  // window is small enough that 6 aggregate() calls per metric is cheap
  // and keeps the SUM at the database level.
  const trendAnchor = end < new Date() ? end : new Date();
  const trendStartMonth = new Date(trendAnchor.getFullYear(), trendAnchor.getMonth() - 5, 1);
  const trendMonths = Array.from({ length: 6 }, (_, i) => new Date(trendStartMonth.getFullYear(), trendStartMonth.getMonth() + i, 1));

  const trend = await Promise.all(trendMonths.map(async (monthStartDate) => {
    const monthEndDate = endOfMonth(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1);
    const [revAgg, expAgg] = await Promise.all([
      prisma.payment.aggregate({
        where: {
          invoice: { property: { organizationId: orgId }, ...propertyFilter },
          status: 'COMPLETED',
          paidAt: { gte: monthStartDate, lte: monthEndDate },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { property: { organizationId: orgId }, date: { gte: monthStartDate, lte: monthEndDate }, ...propertyFilter },
        _sum: { amount: true },
      }),
    ]);
    const rev = Number(revAgg._sum.amount || 0);
    const exp = Number(expAgg._sum.amount || 0);
    return {
      month: monthStartDate.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
      revenue: rev,
      expenses: exp,
      netIncome: rev - exp,
    };
  }));

  return {
    range: { startDate: start, endDate: end },
    revenue: { total: revenue, count: revenueAgg._count },
    expenses: {
      total: expensesTotal,
      byCategory: expensesByCategory
        .map((e) => ({ category: e.category, amount: Number(e._sum.amount || 0), count: e._count }))
        .sort((a, b) => b.amount - a.amount),
    },
    outstanding: { total: outstanding, count: outstandingBalance.count },
    invoiced: { total: invoicedTotal, count: invoicedAgg._count },
    netIncome,
    collectionRate,
    trend,
  };
}

// Core data for the "By Property" report: revenue/expenses/occupancy per
// property so a landlord can see which buildings are actually profitable.
// Every per-property figure is computed with SUM/COUNT at the database
// level (groupBy, or a join for revenue — see paymentAggregates.js) —
// this used to pull every property's invoices/payments/expenses into the
// app via nested includes and reduce() them in JS, which meant the
// response time scaled with total transaction volume across the whole
// portfolio instead of with the (small, fixed) number of properties.
async function computeByProperty(orgId, start, end) {
  const properties = await prisma.property.findMany({
    where: { organizationId: orgId, isActive: true },
    include: { units: { select: { status: true } } },
    orderBy: { name: 'asc' },
  });

  if (properties.length === 0) {
    return {
      range: { startDate: start, endDate: end },
      properties: [],
      totals: {
        revenue: 0, expenses: 0, outstanding: 0, netIncome: 0,
        totalUnits: 0, occupiedUnits: 0, invoicesRaised: 0,
        occupancyRate: 0, margin: 0,
      },
    };
  }

  const propertyIds = properties.map((p) => p.id);

  const [outstandingMap, invoicedByProperty, revenueByProperty, expensesByPropertyAndCategory] = await Promise.all([
    // Cumulative-to-date unpaid balance per property, matching
    // computeOverview's outstanding definition — not scoped to invoices
    // raised within the selected window, so it doesn't miss earlier
    // unpaid invoices that are still owed. Net of payments already applied
    // (a partially-paid invoice only contributes its remaining balance).
    getOutstandingBalanceByProperty(prisma, propertyIds, end),
    prisma.invoice.groupBy({
      by: ['propertyId'],
      where: { propertyId: { in: propertyIds }, dueDate: { gte: start, lte: end } },
      _count: true,
    }),
    getCompletedPaymentTotalsByProperty(prisma, propertyIds, start, end),
    prisma.expense.groupBy({
      by: ['propertyId', 'category'],
      where: { propertyId: { in: propertyIds }, date: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
  ]);

  const invoicedCountMap = Object.fromEntries(invoicedByProperty.map((r) => [r.propertyId, r._count]));

  // expensesByPropertyAndCategory is one row per (property, category) pair
  // — a handful of rows per property, not one per expense — cheap to fold
  // into a per-property map in JS.
  const expensesByProperty = {};
  for (const row of expensesByPropertyAndCategory) {
    const bucket = expensesByProperty[row.propertyId] || (expensesByProperty[row.propertyId] = { byCategory: {}, total: 0 });
    const amount = Number(row._sum.amount || 0);
    bucket.byCategory[row.category] = amount;
    bucket.total += amount;
  }

  const rows = properties
    .map((prop) => {
      const totalUnits = prop.units.length;
      const occupied = prop.units.filter((u) => u.status === 'OCCUPIED').length;

      const revenue = revenueByProperty[prop.id] || 0;
      const outstanding = outstandingMap[prop.id] || 0;
      const { byCategory: expensesByCategory, total: expensesTotal } = expensesByProperty[prop.id] || { byCategory: {}, total: 0 };
      const topCategoryEntry = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0];

      const netIncome = revenue - expensesTotal;

      return {
        propertyId: prop.id,
        propertyName: prop.name,
        propertyCode: prop.code,
        totalUnits,
        occupiedUnits: occupied,
        occupancyRate: totalUnits > 0 ? Math.round((occupied / totalUnits) * 100) : 0,
        invoicesRaised: invoicedCountMap[prop.id] || 0,
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
          tenancy: { select: { tenantName: true, tenantPhone: true } },
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
          invoice: { select: { invoiceNumber: true, tenancy: { select: { tenantName: true, tenantPhone: true } } } },
        },
        orderBy: { paidAt: 'desc' },
      }),
    ]);

    applyTenantDisplayAll(invoices);
    applyTenantDisplayAll(payments, 'invoice.tenancy');

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
            tenancy: { select: { tenantName: true, tenantPhone: true } },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });
    applyTenantDisplayAll(payments, 'invoice.tenancy');

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

function styleHeaderRow(sheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
}

// Full raw-record export — the detail-level counterpart to exportReport's
// aggregated CSV. Tenants are a roster (not period-scoped: a lease that
// started outside the selected window is still a real tenant right now),
// while Payments/Invoices/Expenses are scoped to the selected period, same
// as every other report on this page.
async function exportFullData(req, res, next) {
  try {
    const orgId = req.user.organizationId;
    const { start, end } = resolveRange(req.query);

    const [tenancies, payments, invoices, expenses] = await Promise.all([
      prisma.tenancy.findMany({
        where: { property: { organizationId: orgId } },
        include: {
          tenant: { select: { name: true, email: true, phone: true } },
          unit: { select: { unitNumber: true } },
          property: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: {
          invoice: { property: { organizationId: orgId } },
          status: 'COMPLETED',
          paidAt: { gte: start, lte: end },
        },
        include: {
          tenant: { select: { name: true } },
          invoice: {
            select: {
              invoiceNumber: true,
              tenancy: { select: { tenantName: true, tenantPhone: true } },
              unit: { select: { unitNumber: true } },
              property: { select: { name: true } },
            },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: { property: { organizationId: orgId }, dueDate: { gte: start, lte: end } },
        include: {
          tenant: { select: { name: true } },
          tenancy: { select: { tenantName: true, tenantPhone: true } },
          unit: { select: { unitNumber: true } },
          property: { select: { name: true } },
          payments: { where: { status: 'COMPLETED' }, select: { amount: true } },
        },
        orderBy: { dueDate: 'desc' },
      }),
      prisma.expense.findMany({
        where: { property: { organizationId: orgId }, date: { gte: start, lte: end } },
        include: { property: { select: { name: true } } },
        orderBy: { date: 'desc' },
      }),
    ]);

    applyTenantDisplayAll(tenancies, null);
    applyTenantDisplayAll(payments, 'invoice.tenancy');
    applyTenantDisplayAll(invoices);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'RentFlow';
    workbook.created = new Date();

    const tenantsSheet = workbook.addWorksheet('Tenants');
    tenantsSheet.columns = [
      { header: 'Name', key: 'name', width: 24 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Property', key: 'property', width: 22 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Rent Amount', key: 'rent', width: 14 },
      { header: 'Deposit', key: 'deposit', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Move-in Date', key: 'startDate', width: 14 },
      { header: 'Move-out Date', key: 'endDate', width: 14 },
    ];
    for (const t of tenancies) {
      tenantsSheet.addRow({
        name: t.tenant?.name || '',
        phone: t.tenant?.phone || '',
        email: t.tenant?.email || '',
        property: t.property?.name || '',
        unit: t.unit?.unitNumber || '',
        rent: Number(t.rentAmount),
        deposit: Number(t.depositAmount),
        status: t.status,
        startDate: t.startDate ? t.startDate.toISOString().slice(0, 10) : '',
        endDate: t.endDate ? t.endDate.toISOString().slice(0, 10) : '',
      });
    }
    tenantsSheet.getColumn('rent').numFmt = '#,##0';
    tenantsSheet.getColumn('deposit').numFmt = '#,##0';
    styleHeaderRow(tenantsSheet);

    const paymentsSheet = workbook.addWorksheet('Payments');
    paymentsSheet.columns = [
      { header: 'Receipt No', key: 'receiptNumber', width: 18 },
      { header: 'Date Paid', key: 'paidAt', width: 14 },
      { header: 'Tenant', key: 'tenant', width: 24 },
      { header: 'Property', key: 'property', width: 22 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Invoice No', key: 'invoiceNumber', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Method', key: 'method', width: 14 },
    ];
    for (const p of payments) {
      paymentsSheet.addRow({
        receiptNumber: p.receiptNumber || '',
        paidAt: p.paidAt ? p.paidAt.toISOString().slice(0, 10) : '',
        tenant: p.tenant?.name || '',
        property: p.invoice?.property?.name || '',
        unit: p.invoice?.unit?.unitNumber || '',
        invoiceNumber: p.invoice?.invoiceNumber || '',
        amount: Number(p.amount),
        method: p.method,
      });
    }
    paymentsSheet.getColumn('amount').numFmt = '#,##0';
    styleHeaderRow(paymentsSheet);

    const invoicesSheet = workbook.addWorksheet('Invoices');
    invoicesSheet.columns = [
      { header: 'Invoice No', key: 'invoiceNumber', width: 18 },
      { header: 'Tenant', key: 'tenant', width: 24 },
      { header: 'Property', key: 'property', width: 22 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Paid', key: 'paid', width: 14 },
      { header: 'Balance Due', key: 'balance', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Due Date', key: 'dueDate', width: 14 },
    ];
    for (const inv of invoices) {
      const paidSum = (inv.payments || []).reduce((s, p) => s + Number(p.amount), 0);
      invoicesSheet.addRow({
        invoiceNumber: inv.invoiceNumber,
        tenant: inv.tenant?.name || '',
        property: inv.property?.name || '',
        unit: inv.unit?.unitNumber || '',
        amount: Number(inv.amount),
        paid: paidSum,
        balance: Math.max(Number(inv.amount) - paidSum, 0),
        status: inv.status,
        dueDate: inv.dueDate ? inv.dueDate.toISOString().slice(0, 10) : '',
      });
    }
    ['amount', 'paid', 'balance'].forEach((k) => { invoicesSheet.getColumn(k).numFmt = '#,##0'; });
    styleHeaderRow(invoicesSheet);

    const expensesSheet = workbook.addWorksheet('Expenses');
    expensesSheet.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Property', key: 'property', width: 22 },
      { header: 'Category', key: 'category', width: 18 },
      { header: 'Amount', key: 'amount', width: 14 },
      { header: 'Vendor', key: 'vendor', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
    ];
    for (const e of expenses) {
      expensesSheet.addRow({
        date: e.date ? e.date.toISOString().slice(0, 10) : '',
        property: e.property?.name || '',
        category: e.category,
        amount: Number(e.amount),
        vendor: e.vendor || '',
        description: e.description || '',
      });
    }
    expensesSheet.getColumn('amount').numFmt = '#,##0';
    styleHeaderRow(expensesSheet);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="rentflow-full-data-export.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
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
  exportFullData,
  subscription,
};
