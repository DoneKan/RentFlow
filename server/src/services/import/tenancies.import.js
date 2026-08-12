const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sendWelcomeEmail } = require('../../utils/emailService');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const columns = [
  { key: 'propertyName', header: 'Property Name', required: true },
  { key: 'unitNumber', header: 'Unit Number', required: true },
  { key: 'tenantName', header: 'Tenant Name', required: true },
  { key: 'tenantEmail', header: 'Tenant Email', required: true },
  { key: 'tenantPhone', header: 'Tenant Phone', required: false },
  { key: 'startDate', header: 'Start Date', required: true },
  { key: 'endDate', header: 'End Date', required: false },
  { key: 'rentAmount', header: 'Rent Amount', required: false },
  { key: 'depositAmount', header: 'Deposit Amount', required: false },
  { key: 'notes', header: 'Notes', required: false },
];

const templateRows = [
  ['Kololo Heights Apartments', 'A1', 'Katale Bukwenda', 'katale.bukwenda@example.com', '+256701234567', '2026-01-01', '', '2500000', '2500000', ''],
  ['Kololo Heights Apartments', 'A2', 'Amina Nakato', 'amina.nakato@example.com', '+256709876543', '2026-02-01', '', '', '1500000', 'Referred by existing tenant'],
];

// A newly-generated temp password is bcrypt-hashed and stored — never
// returned in any API response, never written into ImportBatchRow.data,
// never logged. The account's only working way in is "Forgot Password"
// (welcome email below deliberately doesn't include it), which forces the
// tenant to set their own password before first login.
function generateSecureTempPassword() {
  return crypto.randomBytes(24).toString('base64url');
}

function normalizeKey(propertyId, unitNumber) {
  return `${propertyId}|${unitNumber.trim()}`;
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

  const units = await prisma.unit.findMany({
    where: { property: { organizationId } },
    select: { id: true, unitNumber: true, propertyId: true, rentAmount: true, status: true },
  });
  // Units are indexed per-property (not globally) since unit numbers are
  // only unique within a property — "1" under Property A is unrelated to
  // "1" under Property B.
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

  // Unscoped by organizationId — User.email is globally unique, and the
  // existing manual "Add Tenant" flow (tenant.controller.js) already looks
  // up by email with no org filter, so matching that here avoids two
  // different rules for the same lookup, and avoids racing the DB's unique
  // constraint by trying to create a user whose email exists in another org.
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  const usersByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  return {
    propertyIndex: { exactByName, caseInsensitiveByName },
    unitsByProperty,
    usersByEmail,
    // Mutated as rows are validated in order (see validateRow) — the DB
    // snapshot above is fetched once, so two rows in the same file
    // targeting the same unit would otherwise both see it as VACANT.
    claimedInFileByUnitId: new Map(),
  };
}

function validateRow(fields, context, rowNumber) {
  const errors = [];
  const normalized = {};

  // Resolve the property first — every subsequent unit-related message
  // needs to name it, so a client with several properties that each have a
  // unit "1" is never shown a bare, ambiguous "Unit 1".
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
    } else if (unit.status !== 'VACANT') {
      errors.push(`Unit "${unitNumberRaw}" under property "${property.name}" (code: ${property.code}) already has an active tenancy — end the existing tenancy first, then re-import this row.`);
    } else if (context.claimedInFileByUnitId.has(unit.id)) {
      errors.push(`Unit "${unitNumberRaw}" under property "${property.name}" (code: ${property.code}) was already assigned to row ${context.claimedInFileByUnitId.get(unit.id)} earlier in this file.`);
    } else {
      context.claimedInFileByUnitId.set(unit.id, rowNumber);
    }
  }
  if (unit) {
    normalized.unitId = unit.id;
    normalized.propertyId = property.id;
    normalized.unitRentAmount = unit.rentAmount;
  }

  const tenantName = fields.tenantName.trim();
  if (!tenantName) errors.push('Tenant Name is required.');
  else if (tenantName.length < 2) errors.push('Tenant Name must be at least 2 characters.');
  else if (tenantName.length > 100) errors.push('Tenant Name must be 100 characters or fewer.');
  normalized.tenantName = tenantName;

  const emailRaw = fields.tenantEmail.trim().toLowerCase();
  if (!emailRaw) {
    errors.push('Tenant Email is required.');
  } else if (!EMAIL_RE.test(emailRaw)) {
    errors.push(`Tenant Email must be a valid email address (got "${fields.tenantEmail.trim()}").`);
  } else {
    normalized.tenantEmail = emailRaw;
    const existingUser = context.usersByEmail.get(emailRaw);
    if (existingUser && existingUser.role !== 'TENANT') {
      errors.push(`"${emailRaw}" already belongs to an existing ${existingUser.role} account, not a tenant — use a different email for this tenancy.`);
    } else if (existingUser) {
      normalized.existingTenantId = existingUser.id;
    }
  }

  normalized.tenantPhone = fields.tenantPhone.trim() || null;

  const startRaw = fields.startDate.trim();
  let startDate = null;
  if (!startRaw) {
    errors.push('Start Date is required.');
  } else {
    startDate = new Date(startRaw);
    if (Number.isNaN(startDate.getTime())) {
      errors.push(`Start Date must be a valid date (got "${startRaw}"). Use YYYY-MM-DD.`);
      startDate = null;
    } else {
      normalized.startDate = startDate;
    }
  }

  const endRaw = fields.endDate.trim();
  if (!endRaw) {
    normalized.endDate = null;
  } else {
    const endDate = new Date(endRaw);
    if (Number.isNaN(endDate.getTime())) {
      errors.push(`End Date must be a valid date (got "${endRaw}"). Use YYYY-MM-DD.`);
    } else if (startDate && endDate <= startDate) {
      errors.push('End Date must be after Start Date.');
    } else {
      normalized.endDate = endDate;
    }
  }

  const rentRaw = fields.rentAmount.trim();
  if (!rentRaw) {
    normalized.rentAmount = null; // resolved to the unit's rentAmount at commit time
  } else {
    const rent = Number(rentRaw);
    if (!Number.isFinite(rent) || rent <= 0) {
      errors.push(`Rent Amount must be a positive number (got "${rentRaw}").`);
    } else {
      normalized.rentAmount = rent;
    }
  }

  const depositRaw = fields.depositAmount.trim();
  if (!depositRaw) {
    normalized.depositAmount = 0;
  } else {
    const deposit = Number(depositRaw);
    if (!Number.isFinite(deposit) || deposit < 0) {
      errors.push(`Deposit Amount must be 0 or greater (got "${depositRaw}").`);
    } else {
      normalized.depositAmount = deposit;
    }
  }

  normalized.notes = fields.notes.trim() || null;

  return { normalized, errors };
}

// Unlike Properties/Units, there is no safe "import anyway" duplicate here:
// a unit already claimed earlier in this same file is caught directly in
// validateRow as a hard error, the same way an already-occupied unit from
// prior data is — via context.claimedInFileByUnitId, mutated as rows are
// validated in order (the prefetched DB snapshot alone isn't enough, since
// it's taken once before any row is checked).

async function commitRow(tx, organizationId, userId, normalized) {
  // Re-check for an existing user live, inside the transaction, rather than
  // trusting normalized.existingTenantId from validate time alone — two
  // rows in the same file can share one brand-new email (one tenant renting
  // two units), and since rows commit sequentially in this same
  // transaction, the user an earlier row just created is already visible
  // here and must be reused, not re-created (which would hit the email
  // unique constraint and roll back the whole batch).
  let tenantId = normalized.existingTenantId;
  let newTenant = null;

  if (!tenantId) {
    const alreadyCreated = await tx.user.findUnique({ where: { email: normalized.tenantEmail } });
    if (alreadyCreated) {
      tenantId = alreadyCreated.id;
    } else {
      const hashed = await bcrypt.hash(generateSecureTempPassword(), 12);
      newTenant = await tx.user.create({
        data: {
          name: normalized.tenantName,
          email: normalized.tenantEmail,
          password: hashed,
          phone: normalized.tenantPhone,
          role: 'TENANT',
          organizationId,
        },
      });
      tenantId = newTenant.id;
    }
  }

  const tenancy = await tx.tenancy.create({
    data: {
      unitId: normalized.unitId,
      tenantId,
      propertyId: normalized.propertyId,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      rentAmount: normalized.rentAmount ?? normalized.unitRentAmount,
      depositAmount: normalized.depositAmount,
      status: 'ACTIVE',
      notes: normalized.notes,
    },
  });

  await tx.unit.update({ where: { id: normalized.unitId }, data: { status: 'OCCUPIED' } });

  return { tenancy, newTenant };
}

async function afterCommit(results) {
  const newTenants = results.map((r) => r.newTenant).filter(Boolean);
  await Promise.all(newTenants.map((t) => sendWelcomeEmail(t)));
}

module.exports = {
  key: 'tenancies',
  entityType: 'TENANCY',
  label: 'Tenants & Tenancies',
  allowedRoles: STAFF_ROLES,
  columns,
  templateRows,
  prefetchContext,
  validateRow,
  commitRow,
  afterCommit,
};
