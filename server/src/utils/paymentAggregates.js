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

// True outstanding balance is each SENT/OVERDUE invoice's amount minus
// whatever COMPLETED payments have already been applied to it — a
// partially-paid invoice (e.g. a UGX 500,000 payment against a
// UGX 1,100,000 invoice) still owes its remaining balance, not its full
// original amount. Plain SUM/GROUP BY, no dialect-specific functions.
async function getOutstandingBalance(prisma, { organizationId, dueDateLte, propertyId }) {
  const rows = await prisma.$queryRaw`
    SELECT COALESCE(SUM(i."amount" - COALESCE(pp."paid", 0)), 0) AS "outstanding", COUNT(*) AS "count"
    FROM "invoices" i
    INNER JOIN "properties" prop ON prop."id" = i."propertyId"
    LEFT JOIN (
      SELECT "invoiceId", SUM("amount") AS "paid" FROM "payments" WHERE "status" = 'COMPLETED' GROUP BY "invoiceId"
    ) pp ON pp."invoiceId" = i."id"
    WHERE prop."organizationId" = ${organizationId}
      AND i."status" IN ('SENT', 'OVERDUE')
      AND i."dueDate" <= ${dueDateLte}
      ${propertyId ? Prisma.sql`AND i."propertyId" = ${propertyId}` : Prisma.empty}
  `;
  return { total: Number(rows[0]?.outstanding || 0), count: Number(rows[0]?.count || 0) };
}

// Same balance, grouped per property — used by the "By Property" report.
async function getOutstandingBalanceByProperty(prisma, propertyIds, dueDateLte) {
  if (propertyIds.length === 0) return {};

  const rows = await prisma.$queryRaw`
    SELECT i."propertyId" AS "propertyId", SUM(i."amount" - COALESCE(pp."paid", 0)) AS "outstanding"
    FROM "invoices" i
    LEFT JOIN (
      SELECT "invoiceId", SUM("amount") AS "paid" FROM "payments" WHERE "status" = 'COMPLETED' GROUP BY "invoiceId"
    ) pp ON pp."invoiceId" = i."id"
    WHERE i."propertyId" IN (${Prisma.join(propertyIds)})
      AND i."status" IN ('SENT', 'OVERDUE')
      AND i."dueDate" <= ${dueDateLte}
    GROUP BY i."propertyId"
  `;
  return Object.fromEntries(rows.map((r) => [r.propertyId, Number(r.outstanding || 0)]));
}

module.exports = { getCompletedPaymentTotalsByProperty, getOutstandingBalance, getOutstandingBalanceByProperty };
