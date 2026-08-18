const cron = require('node-cron');
const { generateInvoiceNumber } = require('../utils/generateCode');
const { sendDemandNotice } = require('../utils/emailService');
const { applyTenantDisplay } = require('../utils/tenancyHelpers');
const logger = require('../utils/logger');

const prisma = require('../utils/prisma');

// Adds `months` to `anchorDate`, clamped to the last day of the target
// month when the anchor's day-of-month doesn't exist there (e.g. the 31st
// in a 30-day month, or the 29th-31st in February). Always computed from
// the ORIGINAL anchor day, never from a previously-clamped result — so a
// lease that started on the 31st bills on the 31st in every month long
// enough for it (Mar, May, Jul, ...), and only falls back in the months
// that don't fit, rather than permanently drifting down to 28 forever
// after the first time it passes through February.
function addMonthsFromAnchor(anchorDate, months) {
  const day = anchorDate.getDate();
  const target = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + months, 1);
  const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, daysInTargetMonth));
  return target;
}

function periodMonths(paymentPeriod) {
  switch (paymentPeriod) {
    case 'QUARTERLY': return 3;
    case 'SEMI_ANNUAL': return 6;
    case 'ANNUAL': return 12;
    default: return 1;
  }
}

// Returns the most recent due date on or before `referenceDate` for a
// tenancy that started on `startDate` and bills every `paymentPeriod`.
function getNextDueDate(startDate, paymentPeriod, referenceDate = new Date()) {
  const start = new Date(startDate);
  const today = new Date(referenceDate);
  const months = periodMonths(paymentPeriod);

  let periodsElapsed = 0;
  while (addMonthsFromAnchor(start, (periodsElapsed + 1) * months) <= today) {
    periodsElapsed++;
  }
  return addMonthsFromAnchor(start, periodsElapsed * months);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
    // Tenancies with an ended lease (a turned-over unit) never bill again —
    // status flips to TERMINATED via the terminate endpoint, which this
    // excludes. A fixed-term lease whose endDate has passed but hasn't been
    // operationally terminated yet is handled per-tenancy below, since
    // whether it's "ended before the billing date" depends on the billing
    // date, which is only known once computed for that specific tenancy.
    const activeTenancies = await prisma.tenancy.findMany({
      where: { status: 'ACTIVE' },
      include: { unit: true, tenant: true, property: true },
    });

    for (const tenancy of activeTenancies) {
      const dueDate = getNextDueDate(tenancy.startDate, tenancy.unit.paymentPeriod, today);

      if (tenancy.endDate && tenancy.endDate < dueDate) {
        logger.info(`[InvoiceJob] Tenancy ${tenancy.id} ended before this billing date, skipping`);
        continue;
      }
      if (!isDayAfter(dueDate, today)) continue;

      const billingPeriod = monthKey(dueDate);

      // Fast pre-check to skip the common case cheaply; the
      // (tenancyId, billingPeriod) unique constraint on Invoice is the
      // actual idempotency guarantee below, in case two runs race past
      // this check at the same time (e.g. a manual trigger overlapping
      // the scheduled one).
      const existing = await prisma.invoice.findFirst({
        where: { tenancyId: tenancy.id, billingPeriod },
      });
      if (existing) {
        logger.info(`[InvoiceJob] Draft already exists for tenancy ${tenancy.id}, period ${billingPeriod}, skipping`);
        continue;
      }

      // Current rent, read fresh off the tenancy right now — not the
      // unit's default listed rate, which can differ from what this
      // specific tenant is actually paying (a negotiated rate, or a rent
      // change applied after the lease started via the tenancy update
      // endpoint).
      const unit = tenancy.unit;
      const charges = typeof unit.additionalCharges === 'string'
        ? JSON.parse(unit.additionalCharges || '{}')
        : (unit.additionalCharges || {});
      const items = [
        { description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(tenancy.rentAmount), type: 'rent' },
      ];
      if (charges.utilities) items.push({ description: 'Utilities', amount: Number(charges.utilities), type: 'charge' });
      if (charges.security) items.push({ description: 'Security', amount: Number(charges.security), type: 'charge' });
      if (charges.garbage) items.push({ description: 'Garbage Collection', amount: Number(charges.garbage), type: 'charge' });

      const total = items.reduce((s, i) => s + i.amount, 0);

      // Snapshot what this tenant already owes from before, so the new
      // draft doesn't land in the queue looking like a routine invoice
      // when they're actually behind. Net of payments already applied to
      // each prior invoice — a partially-paid one only still owes its
      // remaining balance, not its full original amount.
      const priorUnpaidInvoices = await prisma.invoice.findMany({
        where: { tenancyId: tenancy.id, status: { in: ['SENT', 'OVERDUE'] } },
        include: { payments: { where: { status: 'COMPLETED' }, select: { amount: true } } },
      });
      const priorUnpaidAmount = priorUnpaidInvoices.reduce((sum, inv) => {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
        return sum + Math.max(Number(inv.amount) - paid, 0);
      }, 0);

      let invoiceNumber = generateInvoiceNumber();
      let attempts = 0;
      while (await prisma.invoice.findUnique({ where: { invoiceNumber } }) && attempts < 10) {
        invoiceNumber = generateInvoiceNumber();
        attempts++;
      }

      try {
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
            billingPeriod,
            priorUnpaidAmount,
          },
        });

        logger.info(`[InvoiceJob] Draft invoice ${invoice.invoiceNumber} created for ${tenancy.tenant.email}, pending review${priorUnpaidAmount > 0 ? ` (tenant has ${priorUnpaidAmount} outstanding from before)` : ''}`);
      } catch (err) {
        if (err.code === 'P2002') {
          logger.info(`[InvoiceJob] Draft for tenancy ${tenancy.id}, period ${billingPeriod} was created by a concurrent run, skipping`);
        } else {
          throw err;
        }
      }
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
        tenancy: { select: { tenantName: true, tenantPhone: true } },
        unit: true,
        property: true,
      },
    });

    for (const invoice of overdueInvoices) {
      applyTenantDisplay(invoice);
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
