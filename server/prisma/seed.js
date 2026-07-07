const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function monthsAgo(n, day = 1) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function pad(n) {
  return String(n).padStart(5, '0');
}

let invoiceSeq = 1000;
let receiptSeq = 500;

function nextInvoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${pad(invoiceSeq++)}`;
}

function nextReceiptNumber() {
  const now = new Date();
  return `RCP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${pad(receiptSeq++)}`;
}

async function main() {
  console.log('🌱 Seeding showcase data...');

  // ── Organisation ─────────────────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org_kampala_properties' },
    update: { plan: 'PREMIUM' },
    create: {
      id: 'org_kampala_properties',
      name: 'Kampala Properties Ltd',
      type: 'COMPANY',
      registrationNumber: 'UG-80020-2020',
      email: 'info@kampalaproperties.ug',
      phone: '+256700000000',
      address: 'Plot 15, Nakasero Road',
      city: 'Kampala',
      country: 'UG',
      currency: 'UGX',
      plan: 'PREMIUM',
      isActive: true,
    },
  });

  // ── Staff accounts ────────────────────────────────────────────────────────────
  const [adminPw, managerPw, manager2Pw] = await Promise.all([
    bcrypt.hash('Admin@1234', 10),
    bcrypt.hash('Manager@1234', 10),
    bcrypt.hash('Manager@1234', 10),
  ]);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@rentflow.ug' },
    update: {},
    create: { email: 'admin@rentflow.ug', password: adminPw, name: 'System Admin', phone: '+256701000001', role: 'ADMIN', organizationId: org.id, isActive: true },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@rentflow.ug' },
    update: {},
    create: { email: 'manager@rentflow.ug', password: managerPw, name: 'John Mukasa', phone: '+256702000002', role: 'PROPERTY_MANAGER', organizationId: org.id, isActive: true },
  });

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@rentflow.ug' },
    update: {},
    create: { email: 'manager2@rentflow.ug', password: manager2Pw, name: 'Sarah Nalwoga', phone: '+256702000099', role: 'PROPERTY_MANAGER', organizationId: org.id, isActive: true },
  });

  console.log('✅ Staff accounts ready');

  // ── Tenant accounts ───────────────────────────────────────────────────────────
  const tenantPw = await bcrypt.hash('Tenant@1234', 10);

  const tenantData = [
    { email: 'tenant@rentflow.ug',        name: 'Grace Namukasa',    phone: '+256703000003' },
    { email: 'david.ochieng@gmail.com',    name: 'David Ochieng',     phone: '+256704000004' },
    { email: 'amina.nakato@gmail.com',     name: 'Amina Nakato',      phone: '+256705000005' },
    { email: 'robert.ssemakula@gmail.com', name: 'Robert Ssemakula',  phone: '+256706000006' },
    { email: 'fatuma.namutebi@gmail.com',  name: 'Fatuma Namutebi',   phone: '+256707000007' },
    { email: 'joseph.kiggundu@gmail.com',  name: 'Joseph Kiggundu',   phone: '+256708000008' },
    { email: 'patricia.akello@gmail.com',  name: 'Patricia Akello',   phone: '+256709000009' },
    { email: 'charles.byamugisha@gmail.com', name: 'Charles Byamugisha', phone: '+256710000010' },
    { email: 'esther.adong@gmail.com',     name: 'Esther Adong',      phone: '+256711000011' },
    { email: 'henry.ssebaduka@gmail.com',  name: 'Henry Ssebaduka',   phone: '+256712000012' },
  ];

  const tenants = [];
  for (const t of tenantData) {
    const u = await prisma.user.upsert({
      where: { email: t.email },
      update: {},
      create: { ...t, password: tenantPw, role: 'TENANT', organizationId: org.id, isActive: true },
    });
    tenants.push(u);
  }
  console.log(`✅ ${tenants.length} tenant accounts ready`);

  // ── Properties ────────────────────────────────────────────────────────────────
  const propertiesData = [
    {
      code: 'NAKS0001',
      name: 'Nakasero Heights',
      type: 'RESIDENTIAL',
      description: 'Luxury apartments in the heart of Nakasero — walking distance to CBD, banks, and embassies.',
      address: 'Plot 22, Nakasero Hill Road',
      city: 'Kampala', district: 'Kampala',
      latitude: 0.3163, longitude: 32.5869,
      amenities: JSON.stringify(['Swimming Pool', 'Parking', 'Security', 'Backup Generator', 'CCTV', 'Gym', 'Rooftop Garden']),
      managerId: manager.id,
    },
    {
      code: 'KOLO0002',
      name: 'Kololo Palms',
      type: 'RESIDENTIAL',
      description: 'Serene serviced apartments in Kololo, ideal for diplomats and senior executives.',
      address: 'Plot 7, Acacia Avenue',
      city: 'Kampala', district: 'Kampala',
      latitude: 0.3280, longitude: 32.5920,
      amenities: JSON.stringify(['Parking', 'Security', 'Backup Generator', 'CCTV', 'Laundry Room', 'Garden']),
      managerId: manager.id,
    },
    {
      code: 'MUYE0003',
      name: 'Muyenga Lake View',
      type: 'RESIDENTIAL',
      description: 'Modern apartments with stunning views of Lake Victoria on the Muyenga hillside.',
      address: 'Plot 45, Tank Hill Road',
      city: 'Kampala', district: 'Makindye',
      latitude: 0.2914, longitude: 32.5987,
      amenities: JSON.stringify(['Lake View', 'Parking', 'Security', 'Backup Generator', 'CCTV', 'Balconies']),
      managerId: manager2.id,
    },
    {
      code: 'NTIN0004',
      name: 'Ntinda Court',
      type: 'MIXED',
      description: 'Mixed-use development — ground floor commercial units, upper floors residential.',
      address: 'Plot 18, Ntinda Road',
      city: 'Kampala', district: 'Kampala',
      latitude: 0.3450, longitude: 32.6180,
      amenities: JSON.stringify(['Parking', 'Security', 'CCTV', 'Backup Generator']),
      managerId: manager2.id,
    },
  ];

  const properties = [];
  for (const p of propertiesData) {
    const prop = await prisma.property.upsert({
      where: { code: p.code },
      update: {},
      create: { ...p, organizationId: org.id, isActive: true },
    });
    properties.push(prop);
  }
  console.log(`✅ ${properties.length} properties ready`);

  const [propNakasero, propKololo, propMuyenga, propNtinda] = properties;

  // ── Units ─────────────────────────────────────────────────────────────────────
  async function upsertUnit(propertyId, data) {
    return prisma.unit.upsert({
      where: { propertyId_unitNumber: { propertyId, unitNumber: data.unitNumber } },
      update: {},
      create: {
        propertyId,
        ...data,
        additionalCharges: JSON.stringify(data.additionalCharges),
        status: 'VACANT',
      },
    });
  }

  // Nakasero Heights — 5 units
  const n1a = await upsertUnit(propNakasero.id, { unitNumber: '1A', floor: 1, type: '2-bedroom', bedrooms: 2, bathrooms: 1, squareMeters: 85, rentAmount: 1200000, additionalCharges: { utilities: 80000, security: 50000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const n1b = await upsertUnit(propNakasero.id, { unitNumber: '1B', floor: 1, type: '1-bedroom', bedrooms: 1, bathrooms: 1, squareMeters: 55, rentAmount: 800000, additionalCharges: { utilities: 60000, security: 50000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const n2a = await upsertUnit(propNakasero.id, { unitNumber: '2A', floor: 2, type: '3-bedroom', bedrooms: 3, bathrooms: 2, squareMeters: 120, rentAmount: 1800000, additionalCharges: { utilities: 100000, security: 50000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const n2b = await upsertUnit(propNakasero.id, { unitNumber: '2B', floor: 2, type: '2-bedroom', bedrooms: 2, bathrooms: 1, squareMeters: 90, rentAmount: 1300000, additionalCharges: { utilities: 80000, security: 50000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const n3a = await upsertUnit(propNakasero.id, { unitNumber: 'PH', floor: 3, type: 'penthouse', bedrooms: 4, bathrooms: 3, squareMeters: 200, rentAmount: 3500000, additionalCharges: { utilities: 150000, security: 50000, garbage: 20000 }, paymentPeriod: 'MONTHLY' });

  // Kololo Palms — 4 units
  const k1a = await upsertUnit(propKololo.id, { unitNumber: '1A', floor: 1, type: '1-bedroom', bedrooms: 1, bathrooms: 1, squareMeters: 60, rentAmount: 900000, additionalCharges: { utilities: 70000, security: 40000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const k1b = await upsertUnit(propKololo.id, { unitNumber: '1B', floor: 1, type: '2-bedroom', bedrooms: 2, bathrooms: 1, squareMeters: 85, rentAmount: 1400000, additionalCharges: { utilities: 85000, security: 40000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const k2a = await upsertUnit(propKololo.id, { unitNumber: '2A', floor: 2, type: '2-bedroom', bedrooms: 2, bathrooms: 2, squareMeters: 95, rentAmount: 1500000, additionalCharges: { utilities: 90000, security: 40000, garbage: 15000 }, paymentPeriod: 'MONTHLY' });
  const k2b = await upsertUnit(propKololo.id, { unitNumber: '2B', floor: 2, type: '3-bedroom', bedrooms: 3, bathrooms: 2, squareMeters: 130, rentAmount: 2000000, additionalCharges: { utilities: 110000, security: 40000, garbage: 20000 }, paymentPeriod: 'MONTHLY' });

  // Muyenga Lake View — 4 units
  const m1a = await upsertUnit(propMuyenga.id, { unitNumber: '101', floor: 1, type: '1-bedroom', bedrooms: 1, bathrooms: 1, squareMeters: 58, rentAmount: 750000, additionalCharges: { utilities: 60000, security: 35000, garbage: 10000 }, paymentPeriod: 'MONTHLY' });
  const m1b = await upsertUnit(propMuyenga.id, { unitNumber: '102', floor: 1, type: '2-bedroom', bedrooms: 2, bathrooms: 1, squareMeters: 80, rentAmount: 1100000, additionalCharges: { utilities: 75000, security: 35000, garbage: 10000 }, paymentPeriod: 'MONTHLY' });
  const m2a = await upsertUnit(propMuyenga.id, { unitNumber: '201', floor: 2, type: '2-bedroom', bedrooms: 2, bathrooms: 2, squareMeters: 90, rentAmount: 1200000, additionalCharges: { utilities: 80000, security: 35000, garbage: 10000 }, paymentPeriod: 'MONTHLY' });
  const m2b = await upsertUnit(propMuyenga.id, { unitNumber: '202', floor: 2, type: '3-bedroom', bedrooms: 3, bathrooms: 2, squareMeters: 115, rentAmount: 1600000, additionalCharges: { utilities: 90000, security: 35000, garbage: 10000 }, paymentPeriod: 'MONTHLY' });

  // Ntinda Court — 3 units (1 commercial, 2 residential)
  const nt1 = await upsertUnit(propNtinda.id, { unitNumber: 'G01', floor: 0, type: 'commercial', bedrooms: 0, bathrooms: 1, squareMeters: 40, rentAmount: 600000, additionalCharges: { utilities: 50000, security: 30000 }, paymentPeriod: 'MONTHLY' });
  const nt2a = await upsertUnit(propNtinda.id, { unitNumber: '1A', floor: 1, type: '2-bedroom', bedrooms: 2, bathrooms: 1, squareMeters: 75, rentAmount: 950000, additionalCharges: { utilities: 65000, security: 30000, garbage: 10000 }, paymentPeriod: 'MONTHLY' });
  const nt2b = await upsertUnit(propNtinda.id, { unitNumber: '1B', floor: 1, type: '2-bedroom', bedrooms: 2, bathrooms: 1, squareMeters: 75, rentAmount: 950000, additionalCharges: { utilities: 65000, security: 30000, garbage: 10000 }, paymentPeriod: 'MONTHLY' });

  console.log('✅ 16 units ready');

  // ── Tenancies ─────────────────────────────────────────────────────────────────
  // Pair each unit with a tenant (leave n3a penthouse and m2b vacant for demo vacancy)
  const tenancyDefs = [
    { unit: n1a, tenant: tenants[0], property: propNakasero, startDate: monthsAgo(8), rent: 1200000 },
    { unit: n1b, tenant: tenants[1], property: propNakasero, startDate: monthsAgo(5), rent: 800000 },
    { unit: n2a, tenant: tenants[2], property: propNakasero, startDate: monthsAgo(10), rent: 1800000 },
    { unit: n2b, tenant: tenants[3], property: propNakasero, startDate: monthsAgo(3), rent: 1300000 },
    { unit: k1a, tenant: tenants[4], property: propKololo, startDate: monthsAgo(7), rent: 900000 },
    { unit: k1b, tenant: tenants[5], property: propKololo, startDate: monthsAgo(6), rent: 1400000 },
    { unit: k2a, tenant: tenants[6], property: propKololo, startDate: monthsAgo(4), rent: 1500000 },
    { unit: m1a, tenant: tenants[7], property: propMuyenga, startDate: monthsAgo(9), rent: 750000 },
    { unit: m1b, tenant: tenants[8], property: propMuyenga, startDate: monthsAgo(5), rent: 1100000 },
    { unit: nt2a, tenant: tenants[9], property: propNtinda, startDate: monthsAgo(2), rent: 950000 },
  ];

  const tenancies = [];
  for (const def of tenancyDefs) {
    const existing = await prisma.tenancy.findUnique({ where: { unitId: def.unit.id } });
    if (existing) {
      tenancies.push(existing);
      continue;
    }
    const tenancy = await prisma.tenancy.create({
      data: {
        unitId: def.unit.id,
        tenantId: def.tenant.id,
        propertyId: def.property.id,
        startDate: def.startDate,
        rentAmount: def.rent,
        depositAmount: def.rent,
        status: 'ACTIVE',
      },
    });
    await prisma.unit.update({ where: { id: def.unit.id }, data: { status: 'OCCUPIED' } });
    tenancies.push(tenancy);
  }
  console.log(`✅ ${tenancies.length} active tenancies created`);

  // ── Helper: create invoice + payment pair ─────────────────────────────────────
  async function createPaidInvoice(tenancy, unit, property, tenant, monthOffset) {
    const dueDate = monthsAgo(monthOffset);
    const charges = JSON.parse(unit.additionalCharges || '{}');
    const items = [{ description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(unit.rentAmount), type: 'rent' }];
    if (charges.utilities) items.push({ description: 'Utilities', amount: charges.utilities, type: 'charge' });
    if (charges.security) items.push({ description: 'Security', amount: charges.security, type: 'charge' });
    if (charges.garbage) items.push({ description: 'Garbage', amount: charges.garbage, type: 'charge' });
    const total = items.reduce((s, i) => s + Number(i.amount), 0);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: nextInvoiceNumber(),
        tenancyId: tenancy.id,
        unitId: unit.id,
        propertyId: property.id,
        tenantId: tenant.id,
        amount: total,
        dueDate,
        items: JSON.stringify(items),
        latePenalty: 0,
        status: 'PAID',
        sentAt: new Date(dueDate.getTime() - 5 * 24 * 3600 * 1000),
        paidAt: new Date(dueDate.getTime() - 2 * 24 * 3600 * 1000),
      },
    });

    const methods = ['MTN_MOMO', 'AIRTEL_MONEY', 'BANK_TRANSFER', 'CASH'];
    const method = methods[Math.floor(Math.random() * methods.length)];
    const paidAt = new Date(dueDate.getTime() - 2 * 24 * 3600 * 1000);

    await prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        tenantId: tenant.id,
        amount: total,
        currency: 'UGX',
        method,
        status: 'COMPLETED',
        receiptNumber: nextReceiptNumber(),
        paidAt,
        createdAt: paidAt,
      },
    });

    return invoice;
  }

  async function createOverdueInvoice(tenancy, unit, property, tenant) {
    const dueDate = daysAgo(12);
    const charges = JSON.parse(unit.additionalCharges || '{}');
    const items = [{ description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(unit.rentAmount), type: 'rent' }];
    if (charges.utilities) items.push({ description: 'Utilities', amount: charges.utilities, type: 'charge' });
    if (charges.security) items.push({ description: 'Security', amount: charges.security, type: 'charge' });
    const total = items.reduce((s, i) => s + Number(i.amount), 0);

    return prisma.invoice.create({
      data: {
        invoiceNumber: nextInvoiceNumber(),
        tenancyId: tenancy.id,
        unitId: unit.id,
        propertyId: property.id,
        tenantId: tenant.id,
        amount: total,
        dueDate,
        items: JSON.stringify(items),
        latePenalty: Math.round(total * 0.05),
        status: 'OVERDUE',
        sentAt: new Date(dueDate.getTime() - 3 * 24 * 3600 * 1000),
      },
    });
  }

  async function createSentInvoice(tenancy, unit, property, tenant) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 5);
    const charges = JSON.parse(unit.additionalCharges || '{}');
    const items = [{ description: `Rent — ${unit.type} Unit ${unit.unitNumber}`, amount: Number(unit.rentAmount), type: 'rent' }];
    if (charges.utilities) items.push({ description: 'Utilities', amount: charges.utilities, type: 'charge' });
    if (charges.security) items.push({ description: 'Security', amount: charges.security, type: 'charge' });
    const total = items.reduce((s, i) => s + Number(i.amount), 0);

    return prisma.invoice.create({
      data: {
        invoiceNumber: nextInvoiceNumber(),
        tenancyId: tenancy.id,
        unitId: unit.id,
        propertyId: property.id,
        tenantId: tenant.id,
        amount: total,
        dueDate,
        items: JSON.stringify(items),
        latePenalty: 0,
        status: 'SENT',
        sentAt: daysAgo(2),
      },
    });
  }

  // 6 months of paid history for each tenancy, plus overdue + current invoices
  let invoiceCount = 0;
  for (let i = 0; i < tenancyDefs.length; i++) {
    const { unit, tenant, property } = tenancyDefs[i];
    const tenancy = tenancies[i];
    const tenancyAgeMonths = Math.round((Date.now() - tenancyDefs[i].startDate.getTime()) / (30 * 24 * 3600 * 1000));
    const historyMonths = Math.min(tenancyAgeMonths, 6);

    // Paid invoices (months 2–N)
    for (let m = historyMonths; m >= 2; m--) {
      const existing = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id, status: 'PAID', dueDate: { gte: monthsAgo(m, 28), lte: monthsAgo(m - 1) } } });
      if (!existing) {
        await createPaidInvoice(tenancy, unit, property, tenant, m);
        invoiceCount++;
      }
    }

    // 3 tenants are overdue on this month's rent (good drama for the dashboard)
    if (i < 3) {
      const existingOverdue = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id, status: 'OVERDUE' } });
      if (!existingOverdue) {
        await createOverdueInvoice(tenancy, unit, property, tenant);
        invoiceCount++;
      }
    } else {
      // Rest have current month sent (awaiting payment)
      const existingSent = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id, status: 'SENT' } });
      if (!existingSent) {
        await createSentInvoice(tenancy, unit, property, tenant);
        invoiceCount++;
      }
    }
  }
  console.log(`✅ ${invoiceCount} invoices + payments created`);

  // ── Expenses ──────────────────────────────────────────────────────────────────
  const expenseDefs = [
    // Nakasero Heights
    { propertyId: propNakasero.id, category: 'UTILITIES', amount: 320000, description: 'Monthly electricity bill — common areas and backup generator', vendor: 'UMEME Ltd', date: monthsAgo(1) },
    { propertyId: propNakasero.id, category: 'SECURITY', amount: 800000, description: 'Security company monthly contract — 3 guards 24/7', vendor: 'Shield Security Uganda', date: monthsAgo(1) },
    { propertyId: propNakasero.id, category: 'MAINTENANCE', amount: 250000, description: 'Lift maintenance and servicing', vendor: 'Otis Elevators Uganda', date: monthsAgo(1) },
    { propertyId: propNakasero.id, category: 'KCCA_TAX', amount: 1200000, description: 'KCCA property rates Q2 2026', vendor: 'KCCA', date: monthsAgo(2) },
    { propertyId: propNakasero.id, category: 'REPAIRS', amount: 180000, description: 'Plumbing repair — Unit 2A bathroom leak', vendor: 'Kampala Plumbing Services', date: monthsAgo(1) },
    { propertyId: propNakasero.id, category: 'UTILITIES', amount: 85000, description: 'Water bill — NWSC monthly', vendor: 'NWSC', date: monthsAgo(1) },
    { propertyId: propNakasero.id, category: 'INSURANCE', amount: 600000, description: 'Building and contents insurance — annual premium Q2', vendor: 'UAP Old Mutual Insurance', date: monthsAgo(3) },
    { propertyId: propNakasero.id, category: 'MAINTENANCE', amount: 95000, description: 'Swimming pool chemical treatment and cleaning', vendor: 'AquaClean Uganda', date: monthsAgo(0) },
    { propertyId: propNakasero.id, category: 'UTILITIES', amount: 310000, description: 'Monthly electricity bill — common areas', vendor: 'UMEME Ltd', date: monthsAgo(2) },

    // Kololo Palms
    { propertyId: propKololo.id, category: 'UTILITIES', amount: 210000, description: 'Electricity bill — common areas and generator', vendor: 'UMEME Ltd', date: monthsAgo(1) },
    { propertyId: propKololo.id, category: 'SECURITY', amount: 600000, description: 'Security guard services — monthly', vendor: 'G4S Uganda', date: monthsAgo(1) },
    { propertyId: propKololo.id, category: 'KCCA_TAX', amount: 900000, description: 'KCCA ground rates — annual', vendor: 'KCCA', date: monthsAgo(4) },
    { propertyId: propKololo.id, category: 'REPAIRS', amount: 120000, description: 'Gate intercom system repair and reconfiguration', vendor: 'TechFix Uganda', date: monthsAgo(2) },
    { propertyId: propKololo.id, category: 'MAINTENANCE', amount: 150000, description: 'Garden landscaping and lawn mowing — monthly', vendor: 'GreenThumb Landscapes', date: monthsAgo(1) },
    { propertyId: propKololo.id, category: 'URA_TAX', amount: 450000, description: 'Rental income tax Q1 2026', vendor: 'URA', date: monthsAgo(3) },

    // Muyenga Lake View
    { propertyId: propMuyenga.id, category: 'UTILITIES', amount: 175000, description: 'Electricity — common areas + water pump', vendor: 'UMEME Ltd', date: monthsAgo(1) },
    { propertyId: propMuyenga.id, category: 'SECURITY', amount: 500000, description: 'Security company monthly contract', vendor: 'Shield Security Uganda', date: monthsAgo(1) },
    { propertyId: propMuyenga.id, category: 'MAINTENANCE', amount: 220000, description: 'External wall repainting — Phase 1', vendor: 'Nakato Painting Works', date: monthsAgo(2) },
    { propertyId: propMuyenga.id, category: 'REPAIRS', amount: 95000, description: 'Roof gutter replacement — Unit 202 section', vendor: 'Roofmaster Uganda', date: monthsAgo(1) },
    { propertyId: propMuyenga.id, category: 'KCCA_TAX', amount: 700000, description: 'KCCA property rates H1 2026', vendor: 'KCCA', date: monthsAgo(5) },

    // Ntinda Court
    { propertyId: propNtinda.id, category: 'UTILITIES', amount: 130000, description: 'Electricity and water bills', vendor: 'UMEME / NWSC', date: monthsAgo(1) },
    { propertyId: propNtinda.id, category: 'SECURITY', amount: 350000, description: 'Security guard — night shift only', vendor: 'Community Guard', date: monthsAgo(1) },
    { propertyId: propNtinda.id, category: 'REPAIRS', amount: 75000, description: 'Main entrance door lock replacement', vendor: 'Kampala Locksmith', date: monthsAgo(0) },
    { propertyId: propNtinda.id, category: 'URA_TAX', amount: 320000, description: 'Rental income withholding tax Q1', vendor: 'URA', date: monthsAgo(3) },
  ];

  let expenseCount = 0;
  for (const exp of expenseDefs) {
    const existing = await prisma.expense.findFirst({
      where: { propertyId: exp.propertyId, description: exp.description },
    });
    if (!existing) {
      await prisma.expense.create({ data: exp });
      expenseCount++;
    }
  }
  console.log(`✅ ${expenseCount} expenses created`);

  // ── Notifications ─────────────────────────────────────────────────────────────
  const notifDefs = [
    { userId: admin.id, type: 'OVERDUE', title: 'Overdue rent alert', message: 'Grace Namukasa (Unit 1A, Nakasero Heights) is 12 days overdue — UGX 1,345,000', isRead: false },
    { userId: admin.id, type: 'OVERDUE', title: 'Overdue rent alert', message: 'David Ochieng (Unit 1B, Nakasero Heights) is 12 days overdue — UGX 925,000', isRead: false },
    { userId: admin.id, type: 'OVERDUE', title: 'Overdue rent alert', message: 'Amina Nakato (Unit 2A, Nakasero Heights) is 12 days overdue — UGX 1,965,000', isRead: false },
    { userId: admin.id, type: 'PAYMENT', title: 'Payment received', message: 'Joseph Kiggundu paid UGX 1,590,000 via MTN MoMo for Unit 2A, Kololo Palms', isRead: true },
    { userId: admin.id, type: 'PAYMENT', title: 'Payment received', message: 'Patricia Akello paid UGX 1,635,000 via Airtel Money for Unit 2B, Kololo Palms', isRead: true },
    { userId: admin.id, type: 'MAINTENANCE', title: 'Maintenance request', message: 'New request from Esther Adong (Unit 101, Muyenga Lake View) — faulty kitchen tap', isRead: false },
    { userId: admin.id, type: 'INVOICE', title: 'Invoices sent', message: '7 rent invoices automatically sent for the current billing cycle', isRead: true },
    { userId: manager.id, type: 'OVERDUE', title: 'Rent overdue — action needed', message: '3 tenants at Nakasero Heights are overdue. Send demand notices?', isRead: false },
    { userId: manager.id, type: 'PAYMENT', title: 'New payment', message: 'Robert Ssemakula paid this month\'s rent via Bank Transfer — UGX 1,445,000', isRead: false },
  ];

  for (const n of notifDefs) {
    await prisma.notification.create({ data: n });
  }
  console.log(`✅ ${notifDefs.length} notifications created`);

  // ── Maintenance requests ───────────────────────────────────────────────────────
  const maintenanceDefs = [
    { tenancyId: tenancies[7].id, unitId: tenancyDefs[7].unit.id, propertyId: propMuyenga.id, tenantId: tenants[7].id, title: 'Kitchen tap dripping constantly', description: 'The kitchen tap has been dripping since Monday. Water is being wasted. Please send a plumber.', priority: 'MEDIUM', status: 'OPEN' },
    { tenancyId: tenancies[0].id, unitId: tenancyDefs[0].unit.id, propertyId: propNakasero.id, tenantId: tenants[0].id, title: 'Bedroom ceiling fan not working', description: 'The ceiling fan in the master bedroom stopped working last week. No obvious damage, may be electrical.', priority: 'LOW', status: 'IN_PROGRESS' },
    { tenancyId: tenancies[4].id, unitId: tenancyDefs[4].unit.id, propertyId: propKololo.id, tenantId: tenants[4].id, title: 'Balcony door lock broken', description: 'The balcony sliding door lock is broken — door cannot be locked from inside. Security concern.', priority: 'HIGH', status: 'OPEN' },
    { tenancyId: tenancies[2].id, unitId: tenancyDefs[2].unit.id, propertyId: propNakasero.id, tenantId: tenants[2].id, title: 'AC unit making loud noise', description: 'The air conditioning unit in the living room has been making a loud rattling noise since yesterday.', priority: 'MEDIUM', status: 'RESOLVED', resolvedAt: daysAgo(5) },
  ];

  for (const m of maintenanceDefs) {
    await prisma.maintenanceRequest.create({ data: m });
  }
  console.log(`✅ ${maintenanceDefs.length} maintenance requests created`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n🎉 Showcase seed complete!\n');
  console.log('📊 Portfolio overview:');
  console.log('   4 properties · 16 units · 10 active tenancies · 6 vacant units');
  console.log('   6 months of invoice + payment history');
  console.log('   3 overdue invoices · 7 current invoices awaiting payment');
  console.log('   24 expense records across all categories');
  console.log('   4 maintenance requests (1 resolved, 1 in-progress, 2 open)');
  console.log('\n📋 Login credentials:');
  console.log('   Admin:    admin@rentflow.ug    / Admin@1234');
  console.log('   Manager:  manager@rentflow.ug  / Manager@1234');
  console.log('   Manager2: manager2@rentflow.ug / Manager@1234');
  console.log('   Tenant:   tenant@rentflow.ug   / Tenant@1234');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
