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

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// A safety cap on how many billing periods of backlog a single tenancy can
// catch up in one run — real recovery from a long-dead cron should still
// terminate quickly rather than mass-generate years of drafts from a bad
// startDate.
const MAX_BACKLOG_PERIODS = 36;

async function createDraftForPeriod(tenancy, dueDate, billingPeriod) {
  // Fast pre-check to skip the common case cheaply; the
  // (tenancyId, billingPeriod) unique constraint on Invoice is the
  // actual idempotency guarantee below, in case two runs race past
  // this check at the same time (e.g. a manual trigger overlapping
  // the scheduled one, or a backlog catch-up overlapping a live cron).
  const existing = await prisma.invoice.findFirst({
    where: { tenancyId: tenancy.id, billingPeriod },
  });
  if (existing) {
    logger.info(`[InvoiceJob] Draft already exists for tenancy ${tenancy.id}, period ${billingPeriod}, skipping`);
    return;
  }

  // Current rent, read fresh off the tenancy right now — not the unit's
  // default listed rate, which can differ from what this specific tenant
  // is actually paying (a negotiated rate, or a rent change applied after
  // the lease started via the tenancy update endpoint).
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

  // Snapshot what this tenant already owes from before, so the new draft
  // doesn't land in the queue looking like a routine invoice when they're
  // actually behind. Net of payments already applied to each prior
  // invoice — a partially-paid one only still owes its remaining balance,
  // not its full original amount.
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

    logger.info(`[InvoiceJob] Draft invoice ${invoice.invoiceNumber} created for ${tenancy.tenant.email}, period ${billingPeriod}, pending review${priorUnpaidAmount > 0 ? ` (tenant has ${priorUnpaidAmount} outstanding from before)` : ''}`);
  } catch (err) {
    if (err.code === 'P2002') {
      logger.info(`[InvoiceJob] Draft for tenancy ${tenancy.id}, period ${billingPeriod} was created by a concurrent run, skipping`);
    } else {
      throw err;
    }
  }
}

// Drafts a rent invoice one day after each active tenancy's billing day —
// it does NOT send it. Drafts sit in the "Draft" queue for staff to review,
// edit line items on, and explicitly send (or cancel). This never emails a
// tenant or a PDF on its own; that only happens via invoice.controller's
// sendInvoice, triggered by a human clicking Send.
//
// Walks every billing period from the tenancy's start through the most
// recent one that's actually reached its draft-eligible day, not just the
// single latest period — the previous version only ever checked "is today
// exactly the day after the current due date", an exact-day match with no
// catch-up. If the cron didn't run (or wasn't deployed, or errored) on
// that one specific day, that period's invoice was lost forever with no
// way to notice later. This version self-heals like syncOverdueStatuses/
// syncEndedTenancies: run it any time, any number of days late, and every
// genuinely missed period still gets its draft, while anything already
// invoiced is skipped via the same (tenancyId, billingPeriod) idempotency
// check as before.
async function processAutoInvoicing() {
  logger.info('[InvoiceJob] Running auto-invoicing check...');
  const today = new Date();

  try {
    // Tenancies with an ended lease (a turned-over unit) never bill again —
    // status flips to TERMINATED via the terminate endpoint, which this
    // excludes. A fixed-term lease whose endDate has passed but hasn't been
    // operationally terminated yet is handled per-period below, since
    // whether a given period is "after the lease ended" depends on that
    // period's own due date.
    const activeTenancies = await prisma.tenancy.findMany({
      where: { status: 'ACTIVE' },
      include: { unit: true, tenant: true, property: true },
    });

    for (const tenancy of activeTenancies) {
      const months = periodMonths(tenancy.unit.paymentPeriod);

      let periodIndex = 0;
      let dueDate = new Date(tenancy.startDate);
      while (periodIndex < MAX_BACKLOG_PERIODS && dueDate <= today) {
        const draftEligibleDay = new Date(dueDate);
        draftEligibleDay.setDate(draftEligibleDay.getDate() + 1);

        if (draftEligibleDay > today) break; // this and every later period aren't due for a draft yet

        if (tenancy.endDate && tenancy.endDate < dueDate) {
          logger.info(`[InvoiceJob] Tenancy ${tenancy.id} ended before billing date ${monthKey(dueDate)}, stopping backlog walk here`);
          break; // lease ended at or before this period — nothing here or later is owed
        }

        await createDraftForPeriod(tenancy, dueDate, monthKey(dueDate));

        periodIndex++;
        dueDate = addMonthsFromAnchor(tenancy.startDate, periodIndex * months);
      }
      if (periodIndex >= MAX_BACKLOG_PERIODS) {
        logger.warn(`[InvoiceJob] Tenancy ${tenancy.id} hit the ${MAX_BACKLOG_PERIODS}-period backlog cap — check its startDate/endDate for a data issue`);
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

async function processEndedTenancies() {
  logger.info('[InvoiceJob] Checking for lapsed tenancies...');
  try {
    const ended = await endLapsedTenancies({});
    logger.info(`[InvoiceJob] Ended ${ended.length} lapsed tenanc${ended.length === 1 ? 'y' : 'ies'}`);
  } catch (err) {
    logger.error('[InvoiceJob] Lapsed tenancy check failed:', err);
  }
}

function initializeJobs() {
  // Lapsed-tenancy check daily at 7 AM EAT, ahead of auto-invoicing —
  // belt-and-suspenders, since processAutoInvoicing already independently
  // skips any tenancy whose endDate has passed the computed billing date
  // regardless of status.
  cron.schedule('0 4 * * *', processEndedTenancies, { timezone: 'Africa/Nairobi' });

  // Auto-invoice daily at 8 AM EAT (UTC+3)
  cron.schedule('0 5 * * *', processAutoInvoicing, { timezone: 'Africa/Nairobi' });

  // Overdue check daily at 9 AM EAT
  cron.schedule('0 6 * * *', processOverdueInvoices, { timezone: 'Africa/Nairobi' });

  logger.info('[InvoiceJob] Cron jobs initialized (lapsed-tenancy @ 7 AM, auto-invoice @ 8 AM, overdue @ 9 AM EAT)');
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

// Ends any ACTIVE tenancy whose fixed-term lease has already passed its End
// Date but hasn't been operationally terminated — the same transition
// tenant.controller.js's terminate() makes when a human clicks "Terminate
// Tenancy", just triggered by the date instead of a click. Deliberately
// does NOT touch endDate (it's already set — that's the trigger) or delete/
// reassign anything, so every invoice/payment/maintenance record already
// attached to this tenancy stays exactly where it is; only status flips,
// same as the manual path.
async function endLapsedTenancies(scopeWhere) {
  const lapsed = await prisma.tenancy.findMany({
    where: { status: 'ACTIVE', endDate: { lt: new Date() }, ...scopeWhere },
    select: { id: true, unitId: true },
  });
  if (lapsed.length === 0) return [];

  await prisma.$transaction([
    prisma.tenancy.updateMany({
      where: { id: { in: lapsed.map((t) => t.id) } },
      data: { status: 'TERMINATED' },
    }),
    prisma.unit.updateMany({
      where: { id: { in: lapsed.map((t) => t.unitId) } },
      data: { status: 'VACANT' },
    }),
  ]);
  return lapsed;
}

// Call at the top of any read path that depends on Tenancy.status ===
// 'ACTIVE' or Unit.status === 'OCCUPIED' — occupancy figures, the Tenants
// list, invoice generation eligibility, tenant/owner portals — scoped to
// the caller's org, no logging, same shape and same reason as
// syncOverdueStatuses: don't wait on the cron for a read to be correct.
async function syncEndedTenancies(organizationId) {
  await endLapsedTenancies({ property: { organizationId } });
}

module.exports = {
  initializeJobs,
  processAutoInvoicing,
  processOverdueInvoices,
  syncOverdueStatuses,
  processEndedTenancies,
  syncEndedTenancies,
};
