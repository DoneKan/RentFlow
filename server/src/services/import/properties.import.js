const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const PROPERTY_TYPES = ['RESIDENTIAL', 'COMMERCIAL', 'MIXED'];

const columns = [
  { key: 'name', header: 'Name', required: true },
  { key: 'type', header: 'Type', required: false },
  { key: 'description', header: 'Description', required: false },
  { key: 'address', header: 'Address', required: true },
  { key: 'city', header: 'City', required: true },
  { key: 'district', header: 'District', required: false },
  { key: 'country', header: 'Country', required: false },
  { key: 'latitude', header: 'Latitude', required: false },
  { key: 'longitude', header: 'Longitude', required: false },
  { key: 'amenities', header: 'Amenities', required: false },
];

const templateRows = [
  ['Kololo Heights Apartments', 'RESIDENTIAL', 'Gated compound with 24hr security', 'Plot 12, Kololo Hill Drive', 'Kampala', 'Kololo', 'UG', '0.3350', '32.5920', 'Parking;Security;Borehole'],
  ['Nakawa Trade Centre', 'COMMERCIAL', '', 'Jinja Road, Nakawa', 'Kampala', 'Nakawa', 'UG', '', '', 'Parking;Generator'],
];

function pad(str, length) {
  return str.length >= length ? str : str + '0'.repeat(length - str.length);
}

// Mirrors utils/generateCode.js's generatePropertyCode, but takes the active
// transaction handle so uniqueness checks and the eventual insert happen
// against the same connection — the shared utility hardcodes the top-level
// prisma client, which would let two rows in the same bulk-import
// transaction race each other on the same generated code.
async function generateUniqueCode(tx, name) {
  const prefix = pad(name.replace(/[^a-zA-Z]/g, '').toUpperCase().substring(0, 4), 4);
  let code;
  let attempts = 0;
  do {
    const digits = String(Math.floor(Math.random() * 9000) + 1000);
    code = `${prefix}${digits}`;
    attempts++;
    if (attempts > 100) throw new Error('Could not generate a unique property code');
  } while (await tx.property.findUnique({ where: { code } }));
  return code;
}

function normalizeKey(name, city) {
  return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
}

// Pure field-level validation — no DB access, so this can run for every row
// in a single pass before any duplicate-detection queries happen.
function validateRow(fields) {
  const errors = [];
  const normalized = {};

  const name = fields.name.trim();
  if (!name) errors.push('Name is required.');
  else if (name.length < 2) errors.push('Name must be at least 2 characters.');
  else if (name.length > 200) errors.push('Name must be 200 characters or fewer.');
  normalized.name = name;

  const typeRaw = fields.type.trim();
  if (!typeRaw) {
    normalized.type = 'RESIDENTIAL';
  } else if (!PROPERTY_TYPES.includes(typeRaw.toUpperCase())) {
    errors.push(`Type must be one of ${PROPERTY_TYPES.join(', ')} (got "${fields.type.trim()}").`);
  } else {
    normalized.type = typeRaw.toUpperCase();
  }

  normalized.description = fields.description.trim() || null;

  const address = fields.address.trim();
  if (!address) errors.push('Address is required.');
  normalized.address = address;

  const city = fields.city.trim();
  if (!city) errors.push('City is required.');
  normalized.city = city;

  normalized.district = fields.district.trim() || null;

  const countryRaw = fields.country.trim();
  if (!countryRaw) {
    normalized.country = 'UG';
  } else if (!/^[A-Za-z]{2}$/.test(countryRaw)) {
    errors.push(`Country must be a 2-letter code (e.g. UG), got "${countryRaw}".`);
  } else {
    normalized.country = countryRaw.toUpperCase();
  }

  const latRaw = fields.latitude.trim();
  if (!latRaw) {
    normalized.latitude = null;
  } else {
    const lat = Number(latRaw);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      errors.push(`Latitude must be a number between -90 and 90 (got "${latRaw}").`);
    } else {
      normalized.latitude = lat;
    }
  }

  const lngRaw = fields.longitude.trim();
  if (!lngRaw) {
    normalized.longitude = null;
  } else {
    const lng = Number(lngRaw);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      errors.push(`Longitude must be a number between -180 and 180 (got "${lngRaw}").`);
    } else {
      normalized.longitude = lng;
    }
  }

  normalized.amenities = fields.amenities
    .split(';')
    .map((a) => a.trim())
    .filter(Boolean);

  return { normalized, errors };
}

// Flags likely duplicates by (name, city) — case-insensitive, trimmed —
// against both already-imported data in this org and other rows earlier in
// the same file. Only called for rows that already passed validateRow
// cleanly; returns a Map<rowNumber, reason>.
async function findDuplicateWarnings(prisma, organizationId, cleanRows) {
  const warnings = new Map();
  if (cleanRows.length === 0) return warnings;

  const existing = await prisma.property.findMany({
    where: { organizationId, isActive: true },
    select: { name: true, city: true, code: true },
  });
  const existingByKey = new Map(existing.map((p) => [normalizeKey(p.name, p.city), p.code]));

  const seenInFile = new Map(); // key -> first rowNumber that used it

  for (const row of cleanRows) {
    const key = normalizeKey(row.normalized.name, row.normalized.city);

    if (existingByKey.has(key)) {
      warnings.set(
        row.rowNumber,
        `A property named "${row.normalized.name}" in ${row.normalized.city} already exists (code: ${existingByKey.get(key)}). This row will be skipped unless you choose to import it anyway.`
      );
      continue;
    }

    if (seenInFile.has(key)) {
      warnings.set(
        row.rowNumber,
        `Duplicate of row ${seenInFile.get(key)} in this file (same name and city). This row will be skipped unless you choose to import it anyway.`
      );
    } else {
      seenInFile.set(key, row.rowNumber);
    }
  }

  return warnings;
}

async function commitRow(tx, organizationId, userId, normalized) {
  const code = await generateUniqueCode(tx, normalized.name);
  return tx.property.create({
    data: {
      code,
      name: normalized.name,
      type: normalized.type,
      description: normalized.description,
      address: normalized.address,
      city: normalized.city,
      district: normalized.district,
      country: normalized.country,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      amenities: JSON.stringify(normalized.amenities),
      managerId: userId,
      organizationId,
    },
  });
}

module.exports = {
  key: 'properties',
  entityType: 'PROPERTY',
  label: 'Properties',
  allowedRoles: STAFF_ROLES,
  columns,
  templateRows,
  validateRow,
  findDuplicateWarnings,
  commitRow,
};
