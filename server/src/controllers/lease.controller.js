const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateLeaseAgreement } = require('../utils/pdfGenerator');

const prisma = new PrismaClient();

async function loadFullTenancy(tenancyId) {
  return prisma.tenancy.findUnique({
    where: { id: tenancyId },
    include: {
      unit: true,
      tenant: true,
      property: { include: { organization: true } },
    },
  });
}

function scopeWhere(req) {
  const isTenant = req.user.role === 'TENANT';
  return isTenant
    ? { tenancy: { tenantId: req.user.id } }
    : { tenancy: { property: { organizationId: req.user.organizationId } } };
}

async function list(req, res, next) {
  try {
    const { tenancyId, status } = req.query;

    const documents = await prisma.leaseDocument.findMany({
      where: {
        ...scopeWhere(req),
        ...(tenancyId && { tenancyId }),
        ...(status && { status }),
      },
      include: {
        tenancy: {
          include: {
            tenant: { select: { id: true, name: true, email: true } },
            unit: { select: { id: true, unitNumber: true } },
            property: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return ApiResponse.success(res, documents);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const document = await prisma.leaseDocument.findFirst({
      where: { id: req.params.id, ...scopeWhere(req) },
      include: {
        tenancy: {
          include: {
            tenant: { select: { id: true, name: true, email: true } },
            unit: { select: { id: true, unitNumber: true } },
            property: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!document) throw ApiError.notFound('Lease document not found');
    return ApiResponse.success(res, document);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { tenancyId } = req.body;

    const tenancy = await prisma.tenancy.findFirst({
      where: { id: tenancyId, property: { organizationId: req.user.organizationId } },
    });
    if (!tenancy) throw ApiError.notFound('Tenancy not found');

    const previousVersions = await prisma.leaseDocument.count({ where: { tenancyId } });

    const document = await prisma.leaseDocument.create({
      data: { tenancyId, status: 'SENT', version: previousVersions + 1 },
    });

    return ApiResponse.created(res, document, 'Lease document generated and sent to tenant');
  } catch (err) {
    next(err);
  }
}

async function download(req, res, next) {
  try {
    const document = await prisma.leaseDocument.findFirst({
      where: { id: req.params.id, ...scopeWhere(req) },
    });
    if (!document) throw ApiError.notFound('Lease document not found');

    const tenancy = await loadFullTenancy(document.tenancyId);
    if (!tenancy) throw ApiError.notFound('Tenancy not found');

    const signature = document.signatureDataUrl
      ? { dataUrl: document.signatureDataUrl, signerName: document.signerName, signedAt: document.signedAt }
      : null;

    const pdfBuffer = await generateLeaseAgreement(
      tenancy, tenancy.unit, tenancy.property, tenancy.tenant, tenancy.property.organization, signature
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="lease-${document.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

async function sign(req, res, next) {
  try {
    const { signatureDataUrl, signerName } = req.body;

    const document = await prisma.leaseDocument.findFirst({
      where: { id: req.params.id, tenancy: { tenantId: req.user.id } },
    });
    if (!document) throw ApiError.notFound('Lease document not found');
    if (document.status === 'SIGNED') throw ApiError.conflict('This lease has already been signed');
    if (document.status === 'DECLINED') throw ApiError.conflict('This lease document is no longer active');

    const updated = await prisma.leaseDocument.update({
      where: { id: document.id },
      data: {
        signatureDataUrl,
        signerName,
        signerIp: req.ip,
        signedAt: new Date(),
        status: 'SIGNED',
      },
    });

    return ApiResponse.success(res, updated, 'Lease signed successfully');
  } catch (err) {
    next(err);
  }
}

async function voidDocument(req, res, next) {
  try {
    const document = await prisma.leaseDocument.findFirst({
      where: { id: req.params.id, tenancy: { property: { organizationId: req.user.organizationId } } },
    });
    if (!document) throw ApiError.notFound('Lease document not found');

    const updated = await prisma.leaseDocument.update({
      where: { id: document.id },
      data: { status: 'DECLINED' },
    });

    return ApiResponse.success(res, updated, 'Lease document voided');
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, download, sign, void: voidDocument };
