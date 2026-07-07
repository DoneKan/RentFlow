const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const prisma = new PrismaClient();

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      userId: req.user.id,
      ...(unread === 'true' && { isRead: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);

    return ApiResponse.paginated(res, notifications, {
      total, page: parseInt(page), limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)), unreadCount,
    });
  } catch (err) {
    next(err);
  }
}

async function markRead(req, res, next) {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notification) throw ApiError.notFound('Notification not found');

    await prisma.notification.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    return ApiResponse.success(res, null, 'Notification marked as read');
  } catch (err) {
    next(err);
  }
}

async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    return ApiResponse.success(res, null, 'All notifications marked as read');
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!notification) throw ApiError.notFound('Notification not found');

    await prisma.notification.delete({ where: { id: req.params.id } });

    return ApiResponse.success(res, null, 'Notification deleted');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, markRead, markAllRead, remove };
