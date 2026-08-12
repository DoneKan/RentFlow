const { generateInvoiceNumber } = require('../../utils/generateCode');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const columns = [
  { key: 'propertyName', header: 'Property Name', required: true },
  { key: 'unitNumber', header: 'Unit Number', required: true },
  { key: 'tenantEmail', header: 'Tenant Email', required: false },
  { key: 'dueDate', header: 'Due Date', required: true },
  { key: 'rentAmount', header: 'Rent Amount', required: false },
  { key: 'additionalCharges', header: 'Additional Charges', required: false },
  { key: 'latePenalty', header: 'Late Penalty', required: false },
  { key: 'notes', header: 'Notes', required: false },
];

const templateRows = [
  ['Kololo Heights Apartments', 'A1', 'katale.bukwenda@example.com', '2026-02-01', '', '', '0', ''],
  ['Kololo Heights Apartments', 'A2', '', '2026-02-01', '1500000', 'Water=20000', '0', 'Imported from previous system'],
];

function normalizeKey(tenancyId, dueDateIso) {
  return `${tenancyId}|${dueDateIso}`;
}

// Same shape invoice.controller.js's buildInvoiceItems produces, so an
// imported invoice with no Rent Amount / Additional Charges override looks
// identical to one the "Create Invoice" button would have made — including
// picking up utilities/security/garbage/etc. from the unit's own stored
// additionalCharges.
function buildDefaultItems(unit, rentAmount) {
  const charges = typeof unit.additionalCharges === 'string'
    ? JSON.parse(unit.additionalCharges || '{}')
    : (unit.additionalCharges || {});

  const items = [
    { description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(rentAmount), type: 'rent' },
  ];
  if (charges.utilities) items.push({ description: 'Utilities', amount: Number(charges.utilities), type: 'charge' });
  if (charges.security) items.push({ description: 'Security', amount: Number(charges.security), type: 'charge' });
  if (charges.garbage) items.push({ description: 'Garbage Collection', amount: Number(charges.garbage), type: 'charge' });
  Object.entries(charges).forEach(([key, val]) => {
    if (!['utilities', 'security', 'garbage'].includes(key)) {
      items.push({ description: key.charAt(0).toUpperCase() + key.slice(1), amount: Number(val), type: 'charge' });
    }
  });
  return items;
}

// Parses "Water=20000;Garbage=5000" the same way units.import.js does.
function parseAdditionalCharges(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const result = {};
  for (const segment of trimmed.split(';')) {
    const part = segment.trim();
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) return null;
    const key = part.slice(0, eqIdx).trim();
    const value = Number(part.slice(eqIdx + 1).trim());
    if (!key || !Number.isFinite(value)) return null;
    result[key] = value;
  }
  return result;
}

async function prefetchContext(prisma, organizationId) {
  const properties = await prisma.property.findMany({
    where: { organizationId, isActive: true },
    select: { id: true, name: true, code: true },
  });
  const exactByName = new Map();
  const caseInsensitiveByName = new Map();
  for (const p of properties) {
    const trimmed = p.name.trim();
    if (!exactByName.has(trimmed)) exactByName.set(trimmed, p);
    const lower = trimmed.toLowerCase();
    if (!caseInsensitiveByName.has(lower)) caseInsensitiveByName.set(lower, []);
    caseInsensitiveByName.get(lower).push(p);
  }

  // Each unit's currently-ACTIVE tenancy (at most one, per the app's own
  // business rule) is what an invoice actually attaches to — a unit with no
  // active tenancy has nothing to invoice.
  const units = await prisma.unit.findMany({
    where: { property: { organizationId } },
    select: {
      id: true, unitNumber: true, propertyId: true, rentAmount: true, additionalCharges: true, type: true,
      tenancies: {
        where: { status: 'ACTIVE' },
        select: { id: true, rentAmount: true, tenant: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  const unitsByProperty = new Map(); // propertyId -> { exactByNumber, caseInsensitiveByNumber }
  for (const u of units) {
    if (!unitsByProperty.has(u.propertyId)) {
      unitsByProperty.set(u.propertyId, { exactByNumber: new Map(), caseInsensitiveByNumber: new Map() });
    }
    const idx = unitsByProperty.get(u.propertyId);
    const trimmed = u.unitNumber.trim();
    if (!idx.exactByNumber.has(trimmed)) idx.exactByNumber.set(trimmed, u);
    const lower = trimmed.toLowerCase();
    if (!idx.caseInsensitiveByNumber.has(lower)) idx.caseInsensitiveByNumber.set(lower, []);
    idx.caseInsensitiveByNumber.get(lower).push(u);
  }

  return { propertyIndex: { exactByName, caseInsensitiveByName }, unitsByProperty };
}

function validateRow(fields, context) {
  const errors = [];
  const normalized = {};

  const propertyNameRaw = fields.propertyName.trim();
  let property = null;
  if (!propertyNameRaw) {
    errors.push('Property Name is required.');
  } else {
    property = context.propertyIndex.exactByName.get(propertyNameRaw);
    if (!property) {
      const nearMisses = context.propertyIndex.caseInsensitiveByName.get(propertyNameRaw.toLowerCase());
      if (nearMisses?.length > 0) {
        errors.push(`No property found with the exact name "${propertyNameRaw}". Property names must match exactly — did you mean "${nearMisses[0].name}"?`);
      } else {
        errors.push(`No property found named "${propertyNameRaw}". Check the spelling, or import/create that property first.`);
      }
    }
  }

  const unitNumberRaw = fields.unitNumber.trim();
  let unit = null;
  let tenancy = null;
  if (!unitNumberRaw) {
    errors.push('Unit Number is required.');
  } else if (property) {
    const unitIndex = context.unitsByProperty.get(property.id);
    unit = unitIndex?.exactByNumber.get(unitNumberRaw);
    if (!unit) {
      const nearMisses = unitIndex?.caseInsensitiveByNumber.get(unitNumberRaw.toLowerCase());
      if (nearMisses?.length > 0) {
        errors.push(`No unit "${unitNumberRaw}" found under property "${property.name}" (code: ${property.code}) — did you mean "${nearMisses[0].unitNumber}"?`);
      } else {
        errors.push(`No unit "${unitNumberRaw}" found under property "${property.name}" (code: ${property.code}). Check the unit number, or import/create that unit first.`);
      }
    } else if (!unit.tenancies[0]) {
      errors.push(`Unit "${unitNumberRaw}" under property "${property.name}" (code: ${property.code}) has no active tenancy — cannot create an invoice for it.`);
    } else {
      tenancy = unit.tenancies[0];
    }
  }

  const tenantEmailRaw = fields.tenantEmail.trim();
  if (tenantEmailRaw && !EMAIL_RE.test(tenantEmailRaw)) {
    errors.push(`Tenant Email must be a valid email address (got "${tenantEmailRaw}").`);
  } else if (tenantEmailRaw && tenancy && tenancy.tenant.email.toLowerCase() !== tenantEmailRaw.toLowerCase()) {
    errors.push(`Unit "${unitNumberRaw}" under property "${property.name}" (code: ${property.code}) is currently tenanted by ${tenancy.tenant.email}, not "${tenantEmailRaw}". Leave Tenant Email blank to skip this check, or fix the mismatch.`);
  }

  if (tenancy && unit) {
    normalized.tenancyId = tenancy.id;
    normalized.unitId = unit.id;
    normalized.propertyId = property.id;
    normalized.tenantId = tenancy.tenant.id;
    normalized.unit = { type: unit.type, unitNumber: unit.unitNumber, additionalCharges: unit.additionalCharges };
    normalized.tenancyRentAmount = tenancy.rentAmount;
  }

  const dueRaw = fields.dueDate.trim();
  if (!dueRaw) {
    errors.push('Due Date is required.');
  } else {
    const dueDate = new Date(dueRaw);
    if (Number.isNaN(dueDate.getTime())) {
      errors.push(`Due Date must be a valid date (got "${dueRaw}"). Use YYYY-MM-DD.`);
    } else {
      normalized.dueDate = dueDate;
    }
  }

  const rentRaw = fields.rentAmount.trim();
  let rentOverride = null;
  if (rentRaw) {
    const rent = Number(rentRaw);
    if (!Number.isFinite(rent) || rent <= 0) {
      errors.push(`Rent Amount must be a positive number (got "${rentRaw}").`);
    } else {
      rentOverride = rent;
    }
  }

  const charges = parseAdditionalCharges(fields.additionalCharges);
  if (charges === null) {
    errors.push(`Additional Charges must be in the format key=amount;key=amount (got "${fields.additionalCharges.trim()}").`);
  }

  // Only build custom items if the row actually overrides something —
  // otherwise defer to the unit's own stored additionalCharges (via
  // buildDefaultItems at commit time), exactly matching what "Create
  // Invoice" with no custom items would produce.
  if (rentRaw || fields.additionalCharges.trim()) {
    normalized.customItems = true;
    normalized.rentOverride = rentOverride;
    normalized.chargeItems = charges || {};
  } else {
    normalized.customItems = false;
  }

  const penaltyRaw = fields.latePenalty.trim();
  if (!penaltyRaw) {
    normalized.latePenalty = 0;
  } else {
    const penalty = Number(penaltyRaw);
    if (!Number.isFinite(penalty) || penalty < 0) {
      errors.push(`Late Penalty must be 0 or greater (got "${penaltyRaw}").`);
    } else {
      normalized.latePenalty = penalty;
    }
  }

  normalized.notes = fields.notes.trim() || null;

  return { normalized, errors };
}

// Possible-duplicate signal for invoices: the same tenancy already has an
// invoice due on the exact same date, either from existing data or an
// earlier row in this file. billingPeriod isn't used for this — imported
// invoices intentionally leave it null (see commitRow), matching how the
// manual "Create Invoice" endpoint already behaves, so it can never collide
// with the recurring job's own bookkeeping use of that column.
async function findDuplicateWarnings(prisma, organizationId, cleanRows) {
  const warnings = new Map();
  if (cleanRows.length === 0) return warnings;

  const existing = await prisma.invoice.findMany({
    where: { property: { organizationId } },
    select: { tenancyId: true, dueDate: true, invoiceNumber: true },
  });
  const existingByKey = new Map(
    existing.map((i) => [normalizeKey(i.tenancyId, i.dueDate.toISOString().slice(0, 10)), i.invoiceNumber])
  );

  const seenInFile = new Map();

  for (const row of cleanRows) {
    const dueIso = row.normalized.dueDate.toISOString().slice(0, 10);
    const key = normalizeKey(row.normalized.tenancyId, dueIso);

    if (existingByKey.has(key)) {
      warnings.set(
        row.rowNumber,
        `This tenancy already has an invoice due ${dueIso} (${existingByKey.get(key)}). This row will be skipped unless you choose to import it anyway.`
      );
      continue;
    }
    if (seenInFile.has(key)) {
      warnings.set(
        row.rowNumber,
        `Duplicate of row ${seenInFile.get(key)} in this file (same tenancy and due date). This row will be skipped unless you choose to import it anyway.`
      );
    } else {
      seenInFile.set(key, row.rowNumber);
    }
  }

  return warnings;
}

async function generateUniqueInvoiceNumber(tx) {
  let invoiceNumber = generateInvoiceNumber();
  let attempts = 0;
  while (await tx.invoice.findUnique({ where: { invoiceNumber } })) {
    if (++attempts > 100) throw new Error('Could not generate a unique invoice number');
    invoiceNumber = generateInvoiceNumber();
  }
  return invoiceNumber;
}

async function commitRow(tx, organizationId, userId, normalized) {
  const items = normalized.customItems
    ? [
        { description: `Rent — ${normalized.unit.type} Unit ${normalized.unit.unitNumber}`, amount: normalized.rentOverride ?? Number(normalized.tenancyRentAmount), type: 'rent' },
        ...Object.entries(normalized.chargeItems).map(([key, val]) => ({
          description: key.charAt(0).toUpperCase() + key.slice(1),
          amount: val,
          type: 'charge',
        })),
      ]
    : buildDefaultItems(normalized.unit, normalized.tenancyRentAmount);

  const total = items.reduce((sum, i) => sum + Number(i.amount), 0) + normalized.latePenalty;
  const invoiceNumber = await generateUniqueInvoiceNumber(tx);

  return tx.invoice.create({
    data: {
      invoiceNumber,
      tenancyId: normalized.tenancyId,
      unitId: normalized.unitId,
      propertyId: normalized.propertyId,
      tenantId: normalized.tenantId,
      amount: total,
      dueDate: normalized.dueDate,
      items: JSON.stringify(items),
      latePenalty: normalized.latePenalty,
      notes: normalized.notes,
      status: 'DRAFT',
      // billingPeriod intentionally left null — see findDuplicateWarnings
      // comment above.
    },
  });
}

module.exports = {
  key: 'invoices',
  entityType: 'INVOICE',
  label: 'Invoices',
  allowedRoles: STAFF_ROLES,
  columns,
  templateRows,
  prefetchContext,
  validateRow,
  findDuplicateWarnings,
  commitRow,
};
