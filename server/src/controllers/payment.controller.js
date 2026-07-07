const { PrismaClient } = require('@prisma/client');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateReceiptNumber } = require('../utils/generateCode');
const { generateReceipt } = require('../utils/pdfGenerator');
const { sendPaymentReceipt } = require('../utils/emailService');
const mtnService = require('../services/mtnService');
const airtelService = require('../services/airtelService');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

async function uniqueReceiptNumber() {
  let rn = generateReceiptNumber();
  let attempts = 0;
  while (await prisma.payment.findUnique({ where: { receiptNumber: rn } }) && attempts < 10) {
    rn = generateReceiptNumber();
    attempts++;
  }
  return rn;
}

async function completePayment(paymentId) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: { include: { unit: true, property: true } },
      tenant: true,
    },
  });
  if (!payment) return;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'COMPLETED', paidAt: new Date() },
    });
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  });

  try {
    const pdfBuffer = await generateReceipt(
      { ...payment, status: 'COMPLETED', paidAt: new Date() },
      payment.invoice,
      payment.tenant,
      payment.invoice.unit,
      payment.invoice.property
    );
    await sendPaymentReceipt(payment.tenant, payment, pdfBuffer);
  } catch (e) {
    logger.error('Receipt generation/email failed:', e);
  }
}

async function list(req, res, next) {
  try {
    const { page = 1, limit = 20, propertyId, tenantId, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      invoice: { property: { organizationId: req.user.organizationId } },
      ...(tenantId && { tenantId }),
      ...(status && { status }),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true, email: true } },
          invoice: {
            select: {
              id: true, invoiceNumber: true, amount: true,
              unit: { select: { unitNumber: true } },
              property: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.payment.count({ where }),
    ]);

    return ApiResponse.paginated(res, payments, {
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    next(err);
  }
}

async function recordManual(req, res, next) {
  try {
    const { invoiceId, amount, method, notes, paidAt } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        property: { organizationId: req.user.organizationId },
      },
      include: { unit: true, property: true, tenant: true },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'PAID') throw ApiError.conflict('Invoice already paid');
    if (invoice.status === 'CANCELLED') throw ApiError.badRequest('Invoice is cancelled');

    const receiptNumber = await uniqueReceiptNumber();

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          invoiceId,
          tenantId: invoice.tenantId,
          amount: amount || invoice.amount,
          method,
          receiptNumber,
          status: 'COMPLETED',
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          notes,
        },
      });
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });
      return p;
    });

    try {
      const pdfBuffer = await generateReceipt(payment, invoice, invoice.tenant, invoice.unit, invoice.property);
      await sendPaymentReceipt(invoice.tenant, payment, pdfBuffer);
    } catch (e) {
      logger.error('Receipt email failed:', e);
    }

    const fullPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        tenant: { select: { id: true, name: true, email: true } },
        invoice: { select: { invoiceNumber: true, amount: true } },
      },
    });

    return ApiResponse.created(res, fullPayment, 'Payment recorded successfully');
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        invoice: { property: { organizationId: req.user.organizationId } },
      },
      include: {
        tenant: { select: { id: true, name: true, email: true, phone: true } },
        invoice: {
          include: {
            unit: true,
            property: true,
          },
        },
      },
    });
    if (!payment) throw ApiError.notFound('Payment not found');

    return ApiResponse.success(res, payment);
  } catch (err) {
    next(err);
  }
}

async function getReceipt(req, res, next) {
  try {
    const payment = await prisma.payment.findFirst({
      where: {
        id: req.params.id,
        invoice: { property: { organizationId: req.user.organizationId } },
      },
      include: {
        tenant: true,
        invoice: { include: { unit: true, property: true } },
      },
    });
    if (!payment) throw ApiError.notFound('Payment not found');
    if (payment.status !== 'COMPLETED') throw ApiError.badRequest('Receipt only available for completed payments');

    const pdfBuffer = await generateReceipt(payment, payment.invoice, payment.tenant, payment.invoice.unit, payment.invoice.property);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${payment.receiptNumber}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

async function initiateMtn(req, res, next) {
  try {
    const { invoiceId, mobileNumber } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'PAID') throw ApiError.conflict('Invoice already paid');

    const receiptNumber = await uniqueReceiptNumber();
    const mtnResult = await mtnService.initiatePayment({
      amount: Number(invoice.amount),
      currency: invoice.currency,
      mobileNumber,
      externalId: invoice.id,
      payerMessage: `Rent payment — Invoice ${invoice.invoiceNumber}`,
      payeeNote: `Rent from ${invoice.tenantId}`,
    });

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        tenantId: invoice.tenantId,
        amount: invoice.amount,
        currency: invoice.currency,
        method: 'MTN_MOMO',
        transactionId: mtnResult.transactionId,
        mobileNumber,
        status: 'PENDING',
        receiptNumber,
      },
    });

    // Simulate async completion
    setTimeout(() => completePayment(payment.id), 6000);

    return ApiResponse.success(res, { paymentId: payment.id, transactionId: mtnResult.transactionId }, mtnResult.message);
  } catch (err) {
    next(err);
  }
}

async function initiateAirtel(req, res, next) {
  try {
    const { invoiceId, mobileNumber } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        property: { organizationId: req.user.organizationId },
      },
    });
    if (!invoice) throw ApiError.notFound('Invoice not found');
    if (invoice.status === 'PAID') throw ApiError.conflict('Invoice already paid');

    const receiptNumber = await uniqueReceiptNumber();
    const airtelResult = await airtelService.initiatePayment({
      amount: Number(invoice.amount),
      currency: invoice.currency,
      mobileNumber,
      externalId: invoice.id,
    });

    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        tenantId: invoice.tenantId,
        amount: invoice.amount,
        currency: invoice.currency,
        method: 'AIRTEL_MONEY',
        transactionId: airtelResult.transactionId,
        mobileNumber,
        status: 'PENDING',
        receiptNumber,
      },
    });

    setTimeout(() => completePayment(payment.id), 6000);

    return ApiResponse.success(res, { paymentId: payment.id, transactionId: airtelResult.transactionId }, airtelResult.message);
  } catch (err) {
    next(err);
  }
}

async function webhookMtn(req, res, next) {
  try {
    const { externalId, status, financialTransactionId } = req.body;

    if (status === 'SUCCESSFUL') {
      const payment = await prisma.payment.findFirst({
        where: { invoice: { id: externalId }, method: 'MTN_MOMO', status: 'PENDING' },
      });
      if (payment) await completePayment(payment.id);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

async function webhookAirtel(req, res, next) {
  try {
    const { transaction } = req.body;
    if (transaction?.status === 'TS') {
      const payment = await prisma.payment.findFirst({
        where: { transactionId: transaction.id, method: 'AIRTEL_MONEY', status: 'PENDING' },
      });
      if (payment) await completePayment(payment.id);
    }
    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, recordManual, getOne, getReceipt, initiateMtn, initiateAirtel, webhookMtn, webhookAirtel };
