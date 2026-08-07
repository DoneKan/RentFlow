const cron = require('node-cron');
const { generateInvoiceNumber } = require('../utils/generateCode');
const { sendDemandNotice } = require('../utils/emailService');
const logger = require('../utils/logger');

const prisma = require('../utils/prisma');

function getNextDueDate(startDate, paymentPeriod, referenceDate = new Date()) {
  const start = new Date(startDate);
  const today = new Date(referenceDate);

  const addMonths = (date, months) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  let months;
  switch (paymentPeriod) {
    case 'QUARTERLY': months = 3; break;
    case 'SEMI_ANNUAL': months = 6; break;
    case 'ANNUAL': months = 12; break;
    default: months = 1;
  }

  let candidate = new Date(start);
  while (candidate <= today) {
    candidate = addMonths(candidate, months);
  }

  // Return the previous candidate (the current due date)
  return addMonths(candidate, -months);
}

function isSameDayOfMonth(date1, date2) {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

function isDayAfter(date1, date2) {
  const dayAfter = new Date(date1);
  dayAfter.setDate(dayAfter.getDate() + 1);
  return isSameDayOfMonth(dayAfter, date2);
}

// Drafts a rent invoice one day after each active tenancy's billing day —
// it does NOT send it. Drafts sit in the "Draft" queue for staff to review,
// edit line items on, and explicitly send (or cancel). This never emails a
// tenant or a PDF on its own; that only happens via invoice.controller's
// sendInvoice, triggered by a human clicking Send.
async function processAutoInvoicing() {
  logger.info('[InvoiceJob] Running auto-invoicing check...');
  const today = new Date();

  try {
    const activeTenancies = await prisma.tenancy.findMany({
      where: { status: 'ACTIVE' },
      include: {
        unit: true,
        tenant: true,
        property: true,
        invoices: {
          where: {
            status: { not: 'CANCELLED' },
            dueDate: {
              gte: new Date(today.getFullYear(), today.getMonth(), 1),
              lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
            },
          },
        },
      },
    });

    for (const tenancy of activeTenancies) {
      const dueDate = getNextDueDate(tenancy.startDate, tenancy.unit.paymentPeriod, today);

      if (!isDayAfter(dueDate, today)) continue;
      if (tenancy.invoices.length > 0) {
        logger.info(`[InvoiceJob] Invoice already exists for tenancy ${tenancy.id} this period, skipping`);
        continue;
      }

      const unit = tenancy.unit;
      const charges = typeof unit.additionalCharges === 'string'
        ? JSON.parse(unit.additionalCharges || '{}')
        : (unit.additionalCharges || {});
      const items = [
        { description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(unit.rentAmount), type: 'rent' },
      ];
      if (charges.utilities) items.push({ description: 'Utilities', amount: Number(charges.utilities), type: 'charge' });
      if (charges.security) items.push({ description: 'Security', amount: Number(charges.security), type: 'charge' });
      if (charges.garbage) items.push({ description: 'Garbage Collection', amount: Number(charges.garbage), type: 'charge' });

      const total = items.reduce((s, i) => s + i.amount, 0);

      let invoiceNumber = generateInvoiceNumber();
      let attempts = 0;
      while (await prisma.invoice.findUnique({ where: { invoiceNumber } }) && attempts < 10) {
        invoiceNumber = generateInvoiceNumber();
        attempts++;
      }

      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          tenancyId: tenancy.id,
          unitId: tenancy.unitId,
          propertyId: tenancy.propertyId,
          tenantId: tenancy.tenantId,
          amount: total,
          dueDate,
          items: JSON.stringify(items),
          status: 'DRAFT',
        },
      });

      logger.info(`[InvoiceJob] Draft invoice ${invoice.invoiceNumber} created for ${tenancy.tenant.email}, pending review`);
    }

    logger.info('[InvoiceJob] Auto-invoicing check complete');
  } catch (err) {
    logger.error('[InvoiceJob] Auto-invoicing failed:', err);
  }
}

async function processOverdueInvoices() {
  logger.info('[InvoiceJob] Checking for overdue invoices...');
  const now = new Date();

  try {
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'SENT',
        dueDate: { lt: now },
      },
      include: {
        tenant: true,
        unit: true,
        property: true,
      },
    });

    for (const invoice of overdueInvoices) {
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: 'OVERDUE' },
      });

      try {
        await sendDemandNotice(invoice.tenant, invoice, invoice.unit, invoice.property);
        logger.info(`[InvoiceJob] Demand notice sent for invoice ${invoice.invoiceNumber} to ${invoice.tenant.email}`);
      } catch (e) {
        logger.error(`[InvoiceJob] Demand notice failed for ${invoice.invoiceNumber}: ${e.message}`);
      }
    }

    logger.info(`[InvoiceJob] Processed ${overdueInvoices.length} overdue invoices`);
  } catch (err) {
    logger.error('[InvoiceJob] Overdue invoice check failed:', err);
  }
}

function initializeJobs() {
  // Auto-invoice daily at 8 AM EAT (UTC+3)
  cron.schedule('0 5 * * *', processAutoInvoicing, { timezone: 'Africa/Nairobi' });

  // Overdue check daily at 9 AM EAT
  cron.schedule('0 6 * * *', processOverdueInvoices, { timezone: 'Africa/Nairobi' });

  logger.info('[InvoiceJob] Cron jobs initialized (auto-invoice @ 8 AM, overdue @ 9 AM EAT)');
}

// A SENT invoice only becomes OVERDUE once the daily cron runs, so any read
// path that filters/displays overdue status can lag up to 24h behind the
// real due date. Call this first (scoped to the caller's org) to flip
// already-due invoices before querying, without waiting on the cron.
// Doesn't send demand-notice emails — that stays the cron's job, exactly once.
async function syncOverdueStatuses(organizationId) {
  await prisma.invoice.updateMany({
    where: {
      status: 'SENT',
      dueDate: { lt: new Date() },
      property: { organizationId },
    },
    data: { status: 'OVERDUE' },
  });
}

module.exports = { initializeJobs, processAutoInvoicing, processOverdueInvoices, syncOverdueStatuses };
