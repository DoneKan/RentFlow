const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = require('../utils/prisma');

async function list(req, res, next) {
  try {
    const { propertyId, isActive } = req.query;

    const reminders = await prisma.landlordExpenseReminder.findMany({
      where: {
        organizationId: req.user.organizationId,
        ...(propertyId && { propertyId }),
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      include: { property: { select: { id: true, name: true } } },
      orderBy: { nextDueDate: 'asc' },
    });

    return ApiResponse.success(res, reminders);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const reminder = await prisma.landlordExpenseReminder.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
      include: { property: { select: { id: true, name: true } } },
    });
    if (!reminder) throw ApiError.notFound('Expense reminder not found');
    return ApiResponse.success(res, reminder);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const {
      propertyId, name, description, amount,
      recurrenceType, customIntervalDays, nextDueDate, remindDaysBefore,
    } = req.body;

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId: req.user.organizationId },
      });
      if (!property) throw ApiError.notFound('Property not found');
    }

    const reminder = await prisma.landlordExpenseReminder.create({
      data: {
        organizationId: req.user.organizationId,
        propertyId: propertyId || null,
        name,
        description,
        amount,
        recurrenceType,
        customIntervalDays: recurrenceType === 'CUSTOM' ? customIntervalDays : null,
        anchorDate: new Date(nextDueDate),
        nextDueDate: new Date(nextDueDate),
        remindDaysBefore: remindDaysBefore ?? 7,
        createdById: req.user.id,
      },
      include: { property: { select: { id: true, name: true } } },
    });

    return ApiResponse.created(res, reminder, 'Expense reminder created');
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const existing = await prisma.landlordExpenseReminder.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Expense reminder not found');

    const {
      propertyId, name, description, amount,
      recurrenceType, customIntervalDays, nextDueDate, remindDaysBefore, isActive,
    } = req.body;

    if (propertyId) {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId: req.user.organizationId },
      });
      if (!property) throw ApiError.notFound('Property not found');
    }

    const nextRecurrenceType = recurrenceType || existing.recurrenceType;

    // Changing the due date, or the recurrence pattern itself, redefines
    // where the recurring cycle is anchored — re-anchor to the (possibly
    // new) next due date and clear any reminder already sent for the old
    // occurrence, so the job computes fresh from here rather than drifting
    // off an anchor that no longer matches what was actually configured.
    const isReschedule = nextDueDate !== undefined || recurrenceType !== undefined || customIntervalDays !== undefined;
    const newAnchor = nextDueDate !== undefined ? new Date(nextDueDate) : existing.nextDueDate;

    const reminder = await prisma.landlordExpenseReminder.update({
      where: { id: existing.id },
      data: {
        ...(propertyId !== undefined && { propertyId: propertyId || null }),
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(amount !== undefined && { amount }),
        ...(recurrenceType && { recurrenceType }),
        ...(customIntervalDays !== undefined && { customIntervalDays: nextRecurrenceType === 'CUSTOM' ? customIntervalDays : null }),
        ...(isReschedule && { anchorDate: newAnchor, nextDueDate: newAnchor, lastReminderForDueDate: null }),
        ...(remindDaysBefore !== undefined && { remindDaysBefore }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { property: { select: { id: true, name: true } } },
    });

    return ApiResponse.success(res, reminder, 'Expense reminder updated');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const existing = await prisma.landlordExpenseReminder.findFirst({
      where: { id: req.params.id, organizationId: req.user.organizationId },
    });
    if (!existing) throw ApiError.notFound('Expense reminder not found');

    await prisma.landlordExpenseReminder.delete({ where: { id: existing.id } });

    return ApiResponse.success(res, null, 'Expense reminder deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
