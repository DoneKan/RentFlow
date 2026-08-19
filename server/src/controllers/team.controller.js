const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = require('../utils/prisma');

// "Team" means staff, not tenants or the portal-only Owner role — those
// are separate concepts with their own flows.
const TEAM_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD', 'ACCOUNTANT'];
const ASSIGNABLE_ROLES = ['ADMIN', 'PROPERTY_MANAGER', 'LANDLORD', 'ACCOUNTANT']; // SUPER_ADMIN excluded, same reasoning as invitation.routes.js

function sanitize(user) {
  const { password, ...rest } = user;
  return rest;
}

async function list(req, res, next) {
  try {
    const members = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId, role: { in: TEAM_ROLES } },
      select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return ApiResponse.success(res, members);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const target = await prisma.user.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId, role: { in: TEAM_ROLES } },
    });
    if (!target) throw ApiError.notFound('Team member not found');

    const { role, isActive } = req.body;

    if (target.id === req.user.id) {
      throw ApiError.badRequest('You cannot change your own role or active status here — ask another Admin.');
    }

    const isDemotingOrDeactivatingAdmin =
      (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN') &&
      ((role !== undefined && role !== 'SUPER_ADMIN' && role !== 'ADMIN') || isActive === false);

    if (isDemotingOrDeactivatingAdmin) {
      const otherActiveAdmins = await prisma.user.count({
        where: {
          organizationId: req.user.organizationId,
          role: { in: ['SUPER_ADMIN', 'ADMIN'] },
          isActive: true,
          id: { not: target.id },
        },
      });
      if (otherActiveAdmins === 0) {
        throw ApiError.badRequest('This organization would have no active Admin left — promote someone else first.');
      }
    }

    const updated = await prisma.user.update({
      where: { id: target.id },
      data: {
        ...(role !== undefined && { role }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return ApiResponse.success(res, sanitize(updated), 'Team member updated');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, update, TEAM_ROLES, ASSIGNABLE_ROLES };
