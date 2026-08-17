// A unit can carry more than one Tenancy row over its lifetime (past tenants
// who moved out, then a new tenant moved in). Callers fetch `unit.tenancies`
// (all of them) and use this to flatten it back into the shape older code
// and clients expect: `tenancy` is the current active one (or null), and
// `tenancyHistory` is everyone else, most recent first.
function attachCurrentTenancy(unit) {
  if (!unit) return unit;
  const { tenancies, ...rest } = unit;
  if (!tenancies) return unit;
  tenancies.forEach((t) => applyTenantDisplay(t, null));
  return {
    ...rest,
    tenancy: tenancies.find((t) => t.status === 'ACTIVE') || null,
    tenancyHistory: tenancies
      .filter((t) => t.status !== 'ACTIVE')
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
  };
}

// Overlays a Tenancy's own tenantName/tenantPhone snapshot onto its linked
// User's name/phone fields, so every existing call site that reads
// `row.tenant.name` (or `.phone`) keeps working unchanged but gets the
// correct per-tenancy value instead of the shared login account's value.
// `row` can either be a Tenancy itself (pass tenancyKey: null), a row with
// a direct `.tenancy` include (Invoice, MaintenanceRequest, ...), or a row
// one level further removed (Payment, whose tenancy hangs off
// `.invoice.tenancy` — pass tenancyKey: 'invoice.tenancy').
function applyTenantDisplay(row, tenancyKey = 'tenancy') {
  if (!row) return row;
  const tenancy = tenancyKey === null
    ? row
    : tenancyKey.split('.').reduce((obj, key) => obj?.[key], row);
  if (!tenancy || !row.tenant) return row;
  if (tenancy.tenantName) row.tenant.name = tenancy.tenantName;
  if (tenancy.tenantPhone !== undefined && tenancy.tenantPhone !== null) {
    row.tenant.phone = tenancy.tenantPhone;
  }
  return row;
}

function applyTenantDisplayAll(rows, tenancyKey = 'tenancy') {
  (rows || []).forEach((row) => applyTenantDisplay(row, tenancyKey));
  return rows;
}

module.exports = { attachCurrentTenancy, applyTenantDisplay, applyTenantDisplayAll };
