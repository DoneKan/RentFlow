const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const PAYMENT_PERIODS = ['MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL'];

const columns = [
  { key: 'propertyName', header: 'Property Name', required: true },
  { key: 'unitNumber', header: 'Unit Number', required: true },
  { key: 'floor', header: 'Floor', required: false },
  { key: 'type', header: 'Type', required: false },
  { key: 'bedrooms', header: 'Bedrooms', required: false },
  { key: 'bathrooms', header: 'Bathrooms', required: false },
  { key: 'squareMeters', header: 'Square Meters', required: false },
  { key: 'rentAmount', header: 'Rent Amount', required: true },
  { key: 'paymentPeriod', header: 'Payment Period', required: false },
  { key: 'additionalCharges', header: 'Additional Charges', required: false },
];

const templateRows = [
  ['Kololo Heights Apartments', 'A1', '1', '2-bedroom', '2', '2', '85', '2500000', 'MONTHLY', 'Water=20000;Garbage=5000'],
  ['Kololo Heights Apartments', 'A2', '1', '1-bedroom', '1', '1', '55', '1500000', 'MONTHLY', ''],
];

function normalizeKey(propertyId, unitNumber) {
  return `${propertyId}|${unitNumber.trim()}`;
}

// Fetches every active property in this org once, indexed for two lookups:
// an exact (trimmed, case-sensitive) match, and a case-insensitive index
// used only to produce a helpful "did you mean" hint — never to silently
// resolve a near-miss as if it were the intended match.
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

  return { exactByName, caseInsensitiveByName };
}

// Parses "Water=20000;Garbage=5000" into { Water: 20000, Garbage: 5000 }.
// Returns null (rather than throwing) on malformed input so the caller can
// attach a proper row-level validation error.
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

function validateRow(fields, context) {
  const errors = [];
  const normalized = {};

  const propertyNameRaw = fields.propertyName.trim();
  if (!propertyNameRaw) {
    errors.push('Property Name is required.');
  } else {
    const match = context.exactByName.get(propertyNameRaw);
    if (match) {
      normalized.propertyId = match.id;
      normalized.propertyName = match.name;
    } else {
      const nearMisses = context.caseInsensitiveByName.get(propertyNameRaw.toLowerCase());
      if (nearMisses?.length > 0) {
        errors.push(
          `No property found with the exact name "${propertyNameRaw}". Property names must match exactly — did you mean "${nearMisses[0].name}"?`
        );
      } else {
        errors.push(`No property found named "${propertyNameRaw}". Check the spelling, or import/create that property first.`);
      }
    }
  }

  const unitNumber = fields.unitNumber.trim();
  if (!unitNumber) errors.push('Unit Number is required.');
  normalized.unitNumber = unitNumber;

  const floorRaw = fields.floor.trim();
  if (!floorRaw) {
    normalized.floor = null;
  } else if (!/^-?\d+$/.test(floorRaw)) {
    errors.push(`Floor must be a whole number (got "${floorRaw}").`);
  } else {
    normalized.floor = parseInt(floorRaw, 10);
  }

  normalized.type = fields.type.trim() || '1-bedroom';

  const bedroomsRaw = fields.bedrooms.trim();
  if (!bedroomsRaw) {
    normalized.bedrooms = 1;
  } else if (!/^\d+$/.test(bedroomsRaw)) {
    errors.push(`Bedrooms must be a whole number 0 or greater (got "${bedroomsRaw}").`);
  } else {
    normalized.bedrooms = parseInt(bedroomsRaw, 10);
  }

  const bathroomsRaw = fields.bathrooms.trim();
  if (!bathroomsRaw) {
    normalized.bathrooms = 1;
  } else if (!/^\d+$/.test(bathroomsRaw)) {
    errors.push(`Bathrooms must be a whole number 0 or greater (got "${bathroomsRaw}").`);
  } else {
    normalized.bathrooms = parseInt(bathroomsRaw, 10);
  }

  const sqmRaw = fields.squareMeters.trim();
  if (!sqmRaw) {
    normalized.squareMeters = null;
  } else {
    const sqm = Number(sqmRaw);
    if (!Number.isFinite(sqm) || sqm <= 0) {
      errors.push(`Square Meters must be a positive number (got "${sqmRaw}").`);
    } else {
      normalized.squareMeters = sqm;
    }
  }

  const rentRaw = fields.rentAmount.trim();
  if (!rentRaw) {
    errors.push('Rent Amount is required.');
  } else {
    const rent = Number(rentRaw);
    if (!Number.isFinite(rent) || rent <= 0) {
      errors.push(`Rent Amount must be a positive number (got "${rentRaw}").`);
    } else {
      normalized.rentAmount = rent;
    }
  }

  const periodRaw = fields.paymentPeriod.trim();
  if (!periodRaw) {
    normalized.paymentPeriod = 'MONTHLY';
  } else if (!PAYMENT_PERIODS.includes(periodRaw.toUpperCase())) {
    errors.push(`Payment Period must be one of ${PAYMENT_PERIODS.join(', ')} (got "${periodRaw}").`);
  } else {
    normalized.paymentPeriod = periodRaw.toUpperCase();
  }

  const charges = parseAdditionalCharges(fields.additionalCharges);
  if (charges === null) {
    errors.push(`Additional Charges must be in the format key=amount;key=amount (got "${fields.additionalCharges.trim()}").`);
  } else {
    normalized.additionalCharges = charges;
  }

  return { normalized, errors };
}

// Flags likely duplicates by (propertyId, unitNumber) — the same pair the
// DB's unique constraint protects — against both already-imported units and
// other rows earlier in this same file, so the real constraint is never hit
// at commit time.
async function findDuplicateWarnings(prisma, organizationId, cleanRows) {
  const warnings = new Map();
  if (cleanRows.length === 0) return warnings;

  const existing = await prisma.unit.findMany({
    where: { property: { organizationId } },
    select: { propertyId: true, unitNumber: true, property: { select: { name: true, code: true } } },
  });
  const existingByKey = new Map(existing.map((u) => [normalizeKey(u.propertyId, u.unitNumber), u.property]));

  const seenInFile = new Map();

  for (const row of cleanRows) {
    const key = normalizeKey(row.normalized.propertyId, row.normalized.unitNumber);

    if (existingByKey.has(key)) {
      const prop = existingByKey.get(key);
      warnings.set(
        row.rowNumber,
        `Unit "${row.normalized.unitNumber}" already exists in ${prop.name} (code: ${prop.code}). This row will be skipped unless you choose to import it anyway.`
      );
      continue;
    }

    if (seenInFile.has(key)) {
      warnings.set(
        row.rowNumber,
        `Duplicate of row ${seenInFile.get(key)} in this file (same property and unit number). This row will be skipped unless you choose to import it anyway.`
      );
    } else {
      seenInFile.set(key, row.rowNumber);
    }
  }

  return warnings;
}

async function commitRow(tx, organizationId, userId, normalized) {
  return tx.unit.create({
    data: {
      propertyId: normalized.propertyId,
      unitNumber: normalized.unitNumber,
      floor: normalized.floor,
      type: normalized.type,
      bedrooms: normalized.bedrooms,
      bathrooms: normalized.bathrooms,
      squareMeters: normalized.squareMeters,
      rentAmount: normalized.rentAmount,
      additionalCharges: JSON.stringify(normalized.additionalCharges),
      paymentPeriod: normalized.paymentPeriod,
      status: 'VACANT',
    },
  });
}

module.exports = {
  key: 'units',
  entityType: 'UNIT',
  label: 'Units',
  allowedRoles: STAFF_ROLES,
  columns,
  templateRows,
  prefetchContext,
  validateRow,
  findDuplicateWarnings,
  commitRow,
};
