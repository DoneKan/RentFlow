const { Prisma } = require('@prisma/client');

// Payment has no direct propertyId column (it only knows its invoiceId) —
// so summing completed payments per property can't be expressed as a
// Prisma `groupBy`, which only groups by columns that actually exist on
// the model being queried. This joins through Invoice at the database
// level instead of pulling every payment row into the app and reducing in
// JS, which is what this used to do and what stops scaling as payment
// volume grows. Plain JOIN + GROUP BY + SUM — no dialect-specific
// functions — so it runs unchanged on both Postgres (prod) and SQLite
// (local dev/tests).
async function getCompletedPaymentTotalsByProperty(prisma, propertyIds, start, end) {
  if (propertyIds.length === 0) return {};

  const rows = await prisma.$queryRaw`
    SELECT i."propertyId" AS "propertyId", SUM(p."amount") AS "total"
    FROM "payments" p
    INNER JOIN "invoices" i ON p."invoiceId" = i."id"
    WHERE p."status" = 'COMPLETED'
      AND p."paidAt" >= ${start}
      AND p."paidAt" <= ${end}
      AND i."propertyId" IN (${Prisma.join(propertyIds)})
    GROUP BY i."propertyId"
  `;

  return Object.fromEntries(rows.map((r) => [r.propertyId, Number(r.total || 0)]));
}

module.exports = { getCompletedPaymentTotalsByProperty };
