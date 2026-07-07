const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Organization
  const org = await prisma.organization.upsert({
    where: { id: 'org_kampala_properties' },
    update: {},
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
  console.log('✅ Organization created:', org.name);

  // Admin user
  const adminPassword = await bcrypt.hash('Admin@1234', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rentflow.ug' },
    update: {},
    create: {
      email: 'admin@rentflow.ug',
      password: adminPassword,
      name: 'System Admin',
      phone: '+256701000001',
      role: 'ADMIN',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log('✅ Admin user created:', admin.email);

  // Property manager
  const managerPassword = await bcrypt.hash('Manager@1234', 12);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@rentflow.ug' },
    update: {},
    create: {
      email: 'manager@rentflow.ug',
      password: managerPassword,
      name: 'John Mukasa',
      phone: '+256702000002',
      role: 'PROPERTY_MANAGER',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log('✅ Property manager created:', manager.email);

  // Property
  const property = await prisma.property.upsert({
    where: { code: 'NAKS0001' },
    update: {},
    create: {
      code: 'NAKS0001',
      name: 'Nakasero Heights',
      type: 'RESIDENTIAL',
      description: 'Modern residential apartments in the heart of Nakasero, Kampala.',
      address: 'Plot 22, Nakasero Hill Road',
      city: 'Kampala',
      district: 'Kampala',
      country: 'UG',
      latitude: 0.3163,
      longitude: 32.5869,
      amenities: JSON.stringify(['Swimming Pool', 'Parking', 'Security', 'Backup Generator', 'CCTV']),
      managerId: manager.id,
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log('✅ Property created:', property.name, '(code:', property.code + ')');

  // Units
  const unit1A = await prisma.unit.upsert({
    where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: '1A' } },
    update: {},
    create: {
      propertyId: property.id,
      unitNumber: '1A',
      floor: 1,
      type: '2-bedroom',
      bedrooms: 2,
      bathrooms: 1,
      squareMeters: 85,
      rentAmount: 1200000,
      currency: 'UGX',
      additionalCharges: JSON.stringify({ utilities: 50000, security: 30000, garbage: 10000 }),
      paymentPeriod: 'MONTHLY',
      status: 'VACANT',
    },
  });

  const unit1B = await prisma.unit.upsert({
    where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: '1B' } },
    update: {},
    create: {
      propertyId: property.id,
      unitNumber: '1B',
      floor: 1,
      type: '1-bedroom',
      bedrooms: 1,
      bathrooms: 1,
      squareMeters: 55,
      rentAmount: 800000,
      currency: 'UGX',
      additionalCharges: JSON.stringify({ utilities: 40000, security: 30000, garbage: 10000 }),
      paymentPeriod: 'MONTHLY',
      status: 'VACANT',
    },
  });

  const unit2A = await prisma.unit.upsert({
    where: { propertyId_unitNumber: { propertyId: property.id, unitNumber: '2A' } },
    update: {},
    create: {
      propertyId: property.id,
      unitNumber: '2A',
      floor: 2,
      type: '3-bedroom',
      bedrooms: 3,
      bathrooms: 2,
      squareMeters: 120,
      rentAmount: 1800000,
      currency: 'UGX',
      additionalCharges: JSON.stringify({ utilities: 70000, security: 30000, garbage: 10000 }),
      paymentPeriod: 'MONTHLY',
      status: 'VACANT',
    },
  });
  console.log('✅ Units created: 1A, 1B, 2A');

  // Tenant user
  const tenantPassword = await bcrypt.hash('Tenant@1234', 12);
  const tenantUser = await prisma.user.upsert({
    where: { email: 'tenant@rentflow.ug' },
    update: {},
    create: {
      email: 'tenant@rentflow.ug',
      password: tenantPassword,
      name: 'Grace Namukasa',
      phone: '+256703000003',
      role: 'TENANT',
      organizationId: org.id,
      isActive: true,
    },
  });
  console.log('✅ Tenant user created:', tenantUser.email);

  // Tenancy for unit 1A
  const existingTenancy = await prisma.tenancy.findFirst({
    where: { unitId: unit1A.id, status: 'ACTIVE' },
  });

  if (!existingTenancy) {
    const startDate = new Date('2026-01-01');
    await prisma.tenancy.create({
      data: {
        unitId: unit1A.id,
        tenantId: tenantUser.id,
        propertyId: property.id,
        startDate,
        rentAmount: unit1A.rentAmount,
        depositAmount: 1200000,
        status: 'ACTIVE',
        notes: 'Initial seed tenancy',
      },
    });

    await prisma.unit.update({
      where: { id: unit1A.id },
      data: { status: 'OCCUPIED' },
    });
    console.log('✅ Tenancy created for unit 1A — Grace Namukasa');
  } else {
    console.log('ℹ️  Tenancy for unit 1A already exists, skipping');
  }

  console.log('\n🎉 Seed complete!');
  console.log('\n📋 Login credentials:');
  console.log('  Admin:   admin@rentflow.ug    / Admin@1234');
  console.log('  Manager: manager@rentflow.ug  / Manager@1234');
  console.log('  Tenant:  tenant@rentflow.ug   / Tenant@1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
