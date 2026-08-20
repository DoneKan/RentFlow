const { postExpenseEntry } = require('../../utils/ledgerPoster');
const prisma = require('../../utils/prisma');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'PROPERTY_MANAGER', 'LANDLORD'];
const CATEGORIES = [
  'UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX',
  'REPAIRS', 'INSURANCE', 'LAND_ACQUISITION', 'CONSTRUCTION', 'OTHER',
];

const columns = [
  { key: 'propertyName', header: 'Property Name', required: true },
  { key: 'unitNumber', header: 'Unit Number', required: false },
  { key: 'category', header: 'Category', required: false },
  { key: 'amount', header: 'Amount', required: true },
  { key: 'description', header: 'Description', required: true },
  { key: 'date', header: 'Date', required: true },
  { key: 'vendor', header: 'Vendor', required: false },
];

const templateRows = [
  ['Kololo Heights Apartments', '', 'KCCA_TAX', '450000', 'Annual property tax', '2026-01-15', 'Kampala Capital City Authority'],
  ['Kololo Heights Apartments', 'A1', 'MAINTENANCE', '120000', 'Plumbing repair — leaking pipe', '2026-01-20', 'Fix-It Plumbers Ltd'],
];

function normalizeKey(propertyId, dateIso, amount, category) {
  return `${propertyId}|${dateIso}|${amount}|${category}`;
}

async function prefetchContext(prisma, organizationId) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { currency: true },
  });

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
    select: { id: true, unitNumber: true, propertyId: true },
  });
  const unitsByProperty = new Map();
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

  return { propertyIndex: { exactByName, caseInsensitiveByName }, unitsByProperty, orgCurrency: organization.currency };
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
    } else {
      normalized.propertyId = property.id;
    }
  }

  const unitNumberRaw = fields.unitNumber.trim();
  if (!unitNumberRaw) {
    normalized.unitId = null;
  } else if (property) {
    const unitIndex = context.unitsByProperty.get(property.id);
    const unit = unitIndex?.exactByNumber.get(unitNumberRaw);
    if (!unit) {
      const nearMisses = unitIndex?.caseInsensitiveByNumber.get(unitNumberRaw.toLowerCase());
      if (nearMisses?.length > 0) {
        errors.push(`No unit "${unitNumberRaw}" found under property "${property.name}" (code: ${property.code}) — did you mean "${nearMisses[0].unitNumber}"?`);
      } else {
        errors.push(`No unit "${unitNumberRaw}" found under property "${property.name}" (code: ${property.code}). Leave Unit Number blank for a property-wide expense, or check the spelling.`);
      }
    } else {
      normalized.unitId = unit.id;
    }
  }

  const categoryRaw = fields.category.trim();
  if (!categoryRaw) {
    normalized.category = 'OTHER';
  } else if (!CATEGORIES.includes(categoryRaw.toUpperCase())) {
    errors.push(`Category must be one of ${CATEGORIES.join(', ')} (got "${categoryRaw}").`);
  } else {
    normalized.category = categoryRaw.toUpperCase();
  }

  const amountRaw = fields.amount.trim();
  if (!amountRaw) {
    errors.push('Amount is required.');
  } else {
    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      errors.push(`Amount must be a positive number (got "${amountRaw}").`);
    } else {
      normalized.amount = amount;
    }
  }

  const description = fields.description.trim();
  if (!description) errors.push('Description is required.');
  normalized.description = description;

  const dateRaw = fields.date.trim();
  if (!dateRaw) {
    errors.push('Date is required.');
  } else {
    const date = new Date(dateRaw);
    if (Number.isNaN(date.getTime())) {
      errors.push(`Date must be a valid date (got "${dateRaw}"). Use YYYY-MM-DD.`);
    } else {
      normalized.date = date;
    }
  }

  normalized.vendor = fields.vendor.trim() || null;
  normalized.currency = context.orgCurrency;

  return { normalized, errors };
}

// Possible-duplicate signal: same property, date, amount and category
// appearing more than once — either already in the DB or earlier in this
// same file. There's no DB-level uniqueness for expenses (unlike Units'
// unitNumber or Invoices' invoice number), so this is purely a heuristic,
// same spirit as Properties' name+city check.
async function findDuplicateWarnings(prisma, organizationId, cleanRows) {
  const warnings = new Map();
  if (cleanRows.length === 0) return warnings;

  const existing = await prisma.expense.findMany({
    where: { property: { organizationId } },
    select: { propertyId: true, date: true, amount: true, category: true },
  });
  const existingKeys = new Set(
    existing.map((e) => normalizeKey(e.propertyId, e.date.toISOString().slice(0, 10), e.amount.toString(), e.category))
  );

  const seenInFile = new Map();

  for (const row of cleanRows) {
    const dateIso = row.normalized.date.toISOString().slice(0, 10);
    const key = normalizeKey(row.normalized.propertyId, dateIso, row.normalized.amount.toString(), row.normalized.category);

    if (existingKeys.has(key)) {
      warnings.set(
        row.rowNumber,
        `A ${row.normalized.category} expense of this exact amount on ${dateIso} already exists for this property. This row will be skipped unless you choose to import it anyway.`
      );
      continue;
    }
    if (seenInFile.has(key)) {
      warnings.set(
        row.rowNumber,
        `Duplicate of row ${seenInFile.get(key)} in this file (same property, date, amount and category). This row will be skipped unless you choose to import it anyway.`
      );
    } else {
      seenInFile.set(key, row.rowNumber);
    }
  }

  return warnings;
}

async function commitRow(tx, organizationId, userId, normalized) {
  return tx.expense.create({
    data: {
      propertyId: normalized.propertyId,
      unitId: normalized.unitId,
      category: normalized.category,
      amount: normalized.amount,
      currency: normalized.currency,
      description: normalized.description,
      date: normalized.date,
      vendor: normalized.vendor,
    },
  });
}

// Ledger posting (General Ledger / Chart of Accounts) is fire-and-forget
// for expenses created through the regular API too (expense.controller.js)
// — mirrored here, run after commit with the same non-transactional client,
// so imported expenses show up in the ledger exactly like manually-entered
// ones instead of silently drifting from it.
async function afterCommit(expenses, organizationId) {
  await Promise.all(expenses.map((expense) => postExpenseEntry(prisma, { expense, organizationId })));
}

module.exports = {
  key: 'expenses',
  entityType: 'EXPENSE',
  label: 'Expenses',
  allowedRoles: STAFF_ROLES,
  columns,
  templateRows,
  prefetchContext,
  validateRow,
  findDuplicateWarnings,
  commitRow,
  afterCommit,
};
