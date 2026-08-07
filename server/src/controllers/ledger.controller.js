const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = require('../utils/prisma');

function dateRangeFilter(query) {
  const { startDate, endDate } = query;
  if (!startDate && !endDate) return undefined;
  return {
    ...(startDate && { gte: new Date(startDate) }),
    ...(endDate && { lte: new Date(endDate) }),
  };
}

async function listEntries(req, res, next) {
  try {
    const { page = 1, limit = 30, accountId, propertyId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const dateFilter = dateRangeFilter(req.query);

    const where = {
      organizationId: req.user.organizationId,
      ...(dateFilter && { date: dateFilter }),
      ...(accountId && { lines: { some: { accountId } } }),
      ...(propertyId && { lines: { some: { propertyId } } }),
    };

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: { account: { select: { id: true, code: true, name: true, type: true } } },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.journalEntry.count({ where }),
    ]);

    return ApiResponse.paginated(res, entries, {
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function getAccountBalance(req, res, next) {
  try {
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!account) throw ApiError.notFound('Account not found');

    const dateFilter = dateRangeFilter(req.query);

    const agg = await prisma.journalLine.aggregate({
      where: {
        accountId: account.id,
        ...(dateFilter && { journalEntry: { date: dateFilter } }),
      },
      _sum: { debit: true, credit: true },
    });

    const debit = Number(agg._sum.debit || 0);
    const credit = Number(agg._sum.credit || 0);
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
    const balance = isDebitNormal ? debit - credit : credit - debit;

    return ApiResponse.success(res, { account, debit, credit, balance });
  } catch (err) {
    next(err);
  }
}

async function getTrialBalance(req, res, next) {
  try {
    const dateFilter = dateRangeFilter(req.query);

    const accounts = await prisma.account.findMany({
      where: { organizationId: req.user.organizationId, isActive: true },
      orderBy: { code: 'asc' },
    });

    const rows = await Promise.all(
      accounts.map(async (account) => {
        const agg = await prisma.journalLine.aggregate({
          where: {
            accountId: account.id,
            ...(dateFilter && { journalEntry: { date: dateFilter } }),
          },
          _sum: { debit: true, credit: true },
        });
        const debit = Number(agg._sum.debit || 0);
        const credit = Number(agg._sum.credit || 0);
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type);
        const balance = isDebitNormal ? debit - credit : credit - debit;
        return { account: { id: account.id, code: account.code, name: account.name, type: account.type }, debit, credit, balance };
      })
    );

    const totals = rows.reduce(
      (acc, r) => ({ debit: acc.debit + r.debit, credit: acc.credit + r.credit }),
      { debit: 0, credit: 0 }
    );

    return ApiResponse.success(res, {
      rows: rows.filter((r) => r.debit !== 0 || r.credit !== 0),
      totals,
      isBalanced: Math.abs(totals.debit - totals.credit) < 0.01,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listEntries, getAccountBalance, getTrialBalance };
