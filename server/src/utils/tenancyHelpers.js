// A unit can carry more than one Tenancy row over its lifetime (past tenants
// who moved out, then a new tenant moved in). Callers fetch `unit.tenancies`
// (all of them) and use this to flatten it back into the shape older code
// and clients expect: `tenancy` is the current active one (or null), and
// `tenancyHistory` is everyone else, most recent first.
function attachCurrentTenancy(unit) {
  if (!unit) return unit;
  const { tenancies, ...rest } = unit;
  if (!tenancies) return unit;
  return {
    ...rest,
    tenancy: tenancies.find((t) => t.status === 'ACTIVE') || null,
    tenancyHistory: tenancies
      .filter((t) => t.status !== 'ACTIVE')
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
  };
}

module.exports = { attachCurrentTenancy };
