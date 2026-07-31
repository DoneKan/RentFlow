const EXPENSE_CATEGORIES = ['UTILITIES', 'SECURITY', 'MAINTENANCE', 'KCCA_TAX', 'URA_TAX', 'REPAIRS', 'INSURANCE', 'OTHER'];

function titleCase(code) {
  return code.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
}

const DEFAULT_ACCOUNTS = [
  { code: 'CASH', name: 'Cash', type: 'ASSET' },
  { code: 'BANK', name: 'Bank Account', type: 'ASSET' },
  { code: 'MOBILE_MONEY', name: 'Mobile Money Clearing', type: 'ASSET' },
  { code: 'RENTAL_INCOME', name: 'Rental Income', type: 'INCOME' },
  ...EXPENSE_CATEGORIES.map((c) => ({ code: c, name: `${titleCase(c)} Expense`, type: 'EXPENSE' })),
];

// Accepts either the main Prisma client or a $transaction handle so it can
// run inside org-registration's transaction, or standalone for existing orgs.
async function seedDefaultChartOfAccounts(prismaClient, organizationId) {
  await Promise.all(
    DEFAULT_ACCOUNTS.map((account) =>
      prismaClient.account.upsert({
        where: { organizationId_code: { organizationId, code: account.code } },
        update: {},
        create: { organizationId, ...account },
      })
    )
  );
}

module.exports = { seedDefaultChartOfAccounts, DEFAULT_ACCOUNTS };
