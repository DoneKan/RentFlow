const properties = require('./properties.import');

// Add each entity's importer here, in dependency order, as it's built:
// properties -> units -> tenancies -> invoices -> expenses.
const registry = {
  [properties.key]: properties,
};

function getImporter(key) {
  return registry[key];
}

module.exports = { getImporter, registry };
