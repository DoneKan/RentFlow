const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateInvoiceNumber } = require('../utils/generateCode');
const { generateInvoice } = require('../utils/pdfGenerator');
const { sendInvoiceEmail, sendRentReminder, sendDemandNotice } = require('../utils/emailService');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

function parseAdditionalCharges(unit) {
  if (!unit) return unit;
  try {
    return {
      ...unit,
      additionalCharges: typeof unit.additionalCharges === 'string'
        ? JSON.parse(unit.additionalCharges)
        : (unit.additionalCharges || {}),
    };
  } catch {
    return { ...unit, additionalCharges: {} };
  }
}

function parseInvoiceItems(invoice) {
  if (!invoice) return invoice;
  try {
    return {
      ...invoice,
      items: typeof invoice.items === 'string' ? JSON.parse(invoice.items) : (invoice.items || []),
    };
  } catch {
    return { ...invoice, items: [] };
  }
}

function buildInvoiceItems(unit) {
  const charges = typeof unit.additionalCharges === 'string'
    ? JSON.parse(unit.additionalCharges || '{}')
    : (unit.additionalCharges || {});

  const items = [
    { description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(unit.rentAmount), type: 'rent' },
  ];

  if (charges.utilities) items.push({ description: 'Utilities', amount: Number(charges.utilities), type: 'charge' });
  if (charges.security) items.push({ description: 'Security', amount: Number(charges.security), type: 'charge' });
  if (charges.garbage) items.push({ description: 'Garbage Collection', amount: Number(charges.garbage), type: 'charge' });

  Object.entries(charges).forEach(([key, val]) => {
    if (!['utilities', 'security', 'garbage'].includes(key)) {
      items.push({ description: key.charAt(0).toUpperCase() + key.slice(1), amount: Number(val), type: 'charge' });
    }
  });

  return items;
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, status, propertyId, tenantId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      property: { organizationId: req.user.organizationId },
      ...(status && { status }),
      ...(propertyId && { propertyId }),
      ...(tenantId && { tenantId }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          unit: { select: { id: true, unitNumber: true } },
          property: { select: { id: true, name: true, code: true } },
          payments: { where: { status: 'COMPLETED' }, select: { id: true, amount: true, method: true, paidAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);

    return ApiResponse.paginated(res, invoices.map(parseInvoiceItems), {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { tenancyId, dueDate, latePenalty, customItems } = req.body;

    const tenancy = await prisma.tenancy.findFirst({
      where: {
        id: tenancyId,
        property: { organizationId: req.user.organizationId },
        status: 'ACTIVE',
      },
      include: { unit: true },
    });
    if (!tenancy) throw ApiError.notFound('Active tenancy not found');

    const items = customItems || buildInvoiceItems(tenancy.unit);
    const total = items.reduce((sum, i) => sum + Number(i.amount), 0) + (Number(latePenalty) || 0);

    let invoiceNumber = generateInvoiceNumber();
    let attempts = 0;
    while (await prisma.invoice.findUnique({ where: { invoiceNumber } }) && attempts < 10) {
      invoiceNumber = generateInvoiceNumber();
      attempts++;
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        tenancyId,
        unitId: tenancy.unitId,
        propertyId: tenancy.propertyId,
        tenantId: tenancy.tenantId,
        amount: total,
        dueDate: new Date(dueDate),
        items: JSON.stringify(items),
        latePenalty: latePenalty || 0,
        status: 'DRAFT',
      },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        unit: { select: { id: true, unitNumber: true, type: true } },
        property: { select: { id: true, name: true, code: true } },
      },
    });

    return ApiResponse.created(res, parseInvoiceItems(invoice), 'Invoice created');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        unit: true,
        property: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!invoice) throw ApiError.notFound('Invoice not found');

    return ApiResponse.success(res, parseInvoiceItems(invoice));
  } catch (err) {
    next(err);
  }
}

async function sendInvoice(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
      include: {
        tenant: true,
        unit: true,
        property: true,
      },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw ApiError.badRequest(`Cannot send a ${invoice.status.toLowerCase()} invoice`);
    }

    const parsed = parseInvoiceItems(invoice);
    const pdfBuffer = await generateInvoice(parsed, parsed.tenant, parsed.unit, parsed.property);
    await sendInvoiceEmail(parsed.tenant, parsed, parsed.unit, parsed.property, pdfBuffer);

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    return ApiResponse.success(res, null, 'Invoice sent to tenant');
  } catch (err) {
    next(err);
  }
}

async function sendReminder(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
      include: { tenant: true, unit: true, property: true },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');

    if (invoice.status === 'OVERDUE') {
      await sendDemandNotice(invoice.tenant, invoice, invoice.unit, invoice.property);
    } else {
      await sendRentReminder(invoice.tenant, invoice, invoice.unit, invoice.property);
    }

    return ApiResponse.success(res, null, 'Reminder sent to tenant');
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: req.params.id,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'PAID') throw ApiError.badRequest('Cannot cancel a paid invoice');

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED' },
    });

    return ApiResponse.success(res, null, 'Invoice cancelled');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getOne, sendInvoice, sendReminder, cancel, buildInvoiceItems };
