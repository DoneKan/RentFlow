// One-off data repair for tenancies whose tenantName/tenantPhone were
// backfilled (migration 20260816120000_tenancy_contact_snapshot) from a
// shared User row. That migration copied users.name/users.phone onto every
// Tenancy pointing at that user — correct for a tenancy that has always had
// its own dedicated login, but for tenancies that share a login (the exact
// pre-existing collision the Aug 17 fix targeted going forward), every one
// of them got the SAME baked-in tenantName/tenantPhone, indistinguishable
// from each other on every page that reads it — including the Tenants list.
//
// The per-tenant identity that was lost when those logins got merged is
// gone from the `users`/`tenancies` tables themselves, but if the tenancy
// came in through the CSV importer, its original per-row values survive
// untouched in ImportBatchRow.data (written before any user-matching or
// merging happens). This script finds tenancies that still share a login
// with another tenancy, matches each one back to its import row by
// (unitId, startDate) — both immutable after creation — and reports what
// it would restore. Tenancies with no matching import row are reported as
// unrecoverable; those need a human to re-enter the correct name/phone via
// the Edit Tenant page, because nothing in the database still holds them.
//
// Usage:
//   node src/scripts/repair-tenant-identity-collisions.js            (dry run, default)
//   node src/scripts/repair-tenant-identity-collisions.js --apply    (writes changes)

const prisma = require('../utils/prisma');

const APPLY = process.argv.includes('--apply');

function sameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.toISOString().slice(0, 10) === db.toISOString().slice(0, 10);
}

async function main() {
  const tenancies = await prisma.tenancy.findMany({
    include: {
      tenant: { select: { id: true, name: true, email: true, phone: true } },
      unit: { select: { unitNumber: true } },
      property: { select: { name: true, organizationId: true } },
    },
  });

  const byTenantId = new Map();
  for (const t of tenancies) {
    if (!byTenantId.has(t.tenantId)) byTenantId.set(t.tenantId, []);
    byTenantId.get(t.tenantId).push(t);
  }
  const collided = tenancies.filter((t) => byTenantId.get(t.tenantId).length > 1);

  if (collided.length === 0) {
    console.log('No tenancies currently share a login. Nothing to repair.');
    return;
  }

  console.log(`${collided.length} tenancy row(s) across ${byTenantId.size ? [...byTenantId.values()].filter((g) => g.length > 1).length : 0} shared login(s).\n`);

  const importRows = await prisma.importBatchRow.findMany({
    where: { imported: true, batch: { entityType: 'TENANCY' } },
    select: { data: true },
  });
  const parsedImportRows = importRows
    .map((r) => { try { return JSON.parse(r.data); } catch { return null; } })
    .filter((r) => r?.normalized?.unitId && r?.normalized?.startDate);

  const recoverable = [];
  const unrecoverable = [];

  for (const t of collided) {
    const match = parsedImportRows.find(
      (r) => r.normalized.unitId === t.unitId && sameDay(r.normalized.startDate, t.startDate)
    );
    if (match) {
      const { tenantName, tenantEmail, tenantPhone } = match.normalized;
      recoverable.push({ tenancy: t, tenantName, tenantEmail, tenantPhone });
    } else {
      unrecoverable.push(t);
    }
  }

  console.log(`Recoverable from CSV import history: ${recoverable.length}`);
  for (const r of recoverable) {
    const t = r.tenancy;
    console.log(
      `  [${t.id}] ${t.property.name} / Unit ${t.unit.unitNumber}: ` +
      `"${t.tenantName}" -> "${r.tenantName}"` +
      (r.tenantEmail ? ` (import row also listed email ${r.tenantEmail} — not auto-applied; see note below)` : '')
    );
  }

  console.log(`\nUnrecoverable — no matching import row, needs manual entry via Edit Tenant: ${unrecoverable.length}`);
  for (const t of unrecoverable) {
    console.log(`  [${t.id}] ${t.property.name} / Unit ${t.unit.unitNumber}, currently shown as "${t.tenantName}" (shared login ${t.tenantId})`);
  }

  if (!APPLY) {
    console.log('\nDry run only — no changes written. Re-run with --apply to update tenantName/tenantPhone for the recoverable rows.');
    return;
  }

  for (const r of recoverable) {
    await prisma.tenancy.update({
      where: { id: r.tenancy.id },
      data: { tenantName: r.tenantName, tenantPhone: r.tenantPhone },
    });
  }
  console.log(`\nApplied: updated tenantName/tenantPhone on ${recoverable.length} tenancy row(s).`);
  console.log(
    'Note: this does NOT change each tenancy\'s login (tenantId) or that login\'s email — they still ' +
    'share one User account, so email-based sends (invoice/reminder emails, password reset) still only ' +
    'reach whichever tenant owns that shared login. Splitting them into separate accounts is a separate, ' +
    'deliberate action (new email or phone-only account per tenant) that this script does not take.'
  );
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
