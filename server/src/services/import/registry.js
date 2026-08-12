const properties = require('./properties.import');
const units = require('./units.import');
const tenancies = require('./tenancies.import');
const invoices = require('./invoices.import');
const expenses = require('./expenses.import');

// Add each entity's importer here, in dependency order, as it's built:
// properties -> units -> tenancies -> invoices -> expenses.
const registry = {
  [properties.key]: properties,
  [units.key]: units,
  [tenancies.key]: tenancies,
  [invoices.key]: invoices,
  [expenses.key]: expenses,
};

function getImporter(key) {
  return registry[key];
}

module.exports = { getImporter, registry };
