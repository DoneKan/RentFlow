const logger = require('./logger');

const METHOD_TO_ASSET_CODE = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK',
  MTN_MOMO: 'MOBILE_MONEY',
  AIRTEL_MONEY: 'MOBILE_MONEY',
};

// Posts a cash-basis journal entry for a completed rent payment:
// Dr Cash/Mobile Money/Bank, Cr Rental Income. No-ops if the org hasn't
// seeded a chart of accounts yet, so this never blocks the payment flow.
async function postPaymentEntry(prisma, { payment, organizationId, propertyId }) {
  try {
    const assetCode = METHOD_TO_ASSET_CODE[payment.method] || 'CASH';
    const [assetAccount, incomeAccount] = await Promise.all([
      prisma.account.findUnique({ where: { organizationId_code: { organizationId, code: assetCode } } }),
      prisma.account.findUnique({ where: { organizationId_code: { organizationId, code: 'RENTAL_INCOME' } } }),
    ]);
    if (!assetAccount || !incomeAccount) return;

    await prisma.journalEntry.create({
      data: {
        organizationId,
        date: payment.paidAt || new Date(),
        memo: `Rent payment received — receipt ${payment.receiptNumber}`,
        reference: payment.receiptNumber,
        sourceType: 'PAYMENT',
        sourceId: payment.id,
        lines: {
          create: [
            { accountId: assetAccount.id, propertyId, debit: payment.amount, credit: 0 },
            { accountId: incomeAccount.id, propertyId, debit: 0, credit: payment.amount },
          ],
        },
      },
    });
  } catch (err) {
    logger.error('Failed to post payment journal entry:', err);
  }
}

// Posts a cash-basis journal entry for an expense: Dr <category> Expense,
// Cr Cash. No-ops if the org hasn't seeded a chart of accounts yet.
async function postExpenseEntry(prisma, { expense, organizationId }) {
  try {
    const [expenseAccount, assetAccount] = await Promise.all([
      prisma.account.findUnique({ where: { organizationId_code: { organizationId, code: expense.category } } }),
      prisma.account.findUnique({ where: { organizationId_code: { organizationId, code: 'CASH' } } }),
    ]);
    if (!expenseAccount || !assetAccount) return;

    await prisma.journalEntry.create({
      data: {
        organizationId,
        date: expense.date,
        memo: `Expense — ${expense.description}`,
        reference: expense.id,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
        lines: {
          create: [
            { accountId: expenseAccount.id, propertyId: expense.propertyId, debit: expense.amount, credit: 0 },
            { accountId: assetAccount.id, propertyId: expense.propertyId, debit: 0, credit: expense.amount },
          ],
        },
      },
    });
  } catch (err) {
    logger.error('Failed to post expense journal entry:', err);
  }
}

module.exports = { postPaymentEntry, postExpenseEntry };
