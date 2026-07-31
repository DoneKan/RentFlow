const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { seedDefaultChartOfAccounts } = require('../utils/defaultChartOfAccounts');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { type, isActive } = req.query;

    const accounts = await prisma.account.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(type && { type }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      orderBy: { code: 'asc' },
    });

    return ApiResponse.success(res, accounts);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { code, name, type } = req.body;

    const account = await prisma.account.create({
      data: { organizationId: req.user.organizationId, code, name, type },
    });

    return ApiResponse.created(res, account, 'Account created');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Account not found');

    const { name, isActive } = req.body;

    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return ApiResponse.success(res, account, 'Account updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Account not found');

    const lineCount = await prisma.journalLine.count({ where: { accountId: existing.id } });
    if (lineCount > 0) throw ApiError.conflict('Cannot delete an account with posted journal entries — deactivate it instead');

    await prisma.account.delete({ where: { id: existing.id } });

    return ApiResponse.success(res, null, 'Account deleted');
  } catch (err) {
    next(err);
  }
}

async function seedDefaults(req, res, next) {
  try {
    await seedDefaultChartOfAccounts(prisma, req.user.organizationId);
    const accounts = await prisma.account.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { code: 'asc' },
    });
    return ApiResponse.success(res, accounts, 'Default chart of accounts ready');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, seedDefaults };
