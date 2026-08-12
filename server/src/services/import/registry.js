const properties = require('./properties.import');
const units = require('./units.import');
const tenancies = require('./tenancies.import');

// Add each entity's importer here, in dependency order, as it's built:
// properties -> units -> tenancies -> invoices -> expenses.
const registry = {
  [properties.key]: properties,
  [units.key]: units,
  [tenancies.key]: tenancies,
};

function getImporter(key) {
  return registry[key];
}

module.exports = { getImporter, registry };
