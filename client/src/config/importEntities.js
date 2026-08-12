// Frontend-side config per importable entity type — keys must match the
// backend's server/src/services/import/registry.js keys exactly.
// `available: false` entities show as "coming soon" on the import hub until
// their importer is built, in dependency order: properties -> units ->
// tenancies -> invoices -> expenses.
export const IMPORT_ENTITIES = {
  properties: {
    label: 'Properties',
    description: 'Bulk-create properties from a spreadsheet.',
    backPath: '/properties',
    backLabel: 'Properties',
    available: true,
    previewColumns: [
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'city', label: 'City' },
      { key: 'address', label: 'Address' },
    ],
  },
  units: {
    label: 'Units',
    description: 'Bulk-create units within properties that already exist.',
    backPath: '/properties',
    backLabel: 'Properties',
    available: true,
    previewColumns: [
      { key: 'propertyName', label: 'Property' },
      { key: 'unitNumber', label: 'Unit #' },
      { key: 'type', label: 'Type' },
      { key: 'rentAmount', label: 'Rent' },
    ],
  },
  tenancies: {
    label: 'Tenants & Tenancies',
    description: 'Bulk-create tenants and assign them to units.',
    backPath: '/tenants',
    backLabel: 'Tenants',
    available: false,
  },
  invoices: {
    label: 'Invoices',
    description: 'Bulk-create invoices for existing tenancies.',
    backPath: '/invoices',
    backLabel: 'Invoices',
    available: false,
  },
  expenses: {
    label: 'Expenses',
    description: 'Bulk-create property and unit expenses.',
    backPath: '/expenses',
    backLabel: 'Expenses',
    available: false,
  },
}

export const IMPORT_ENTITY_ORDER = ['properties', 'units', 'tenancies', 'invoices', 'expenses']
