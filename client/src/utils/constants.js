export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  PROPERTY_MANAGER: 'PROPERTY_MANAGER',
  LANDLORD: 'LANDLORD',
  TENANT: 'TENANT',
}

export const PAYMENT_METHODS = [
  { value: 'MTN_MOMO', label: 'MTN Mobile Money' },
  { value: 'AIRTEL_MONEY', label: 'Airtel Money' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'CASH', label: 'Cash' },
]

export const EXPENSE_CATEGORIES = [
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'SECURITY', label: 'Security' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'REPAIRS', label: 'Repairs' },
  { value: 'KCCA_TAX', label: 'Local Authority Tax' },
  { value: 'URA_TAX', label: 'Income / Rental Tax' },
  { value: 'INSURANCE', label: 'Insurance' },
  { value: 'OTHER', label: 'Other' },
]

export const PROPERTY_TYPES = [
  { value: 'RESIDENTIAL', label: 'Residential' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'MIXED', label: 'Mixed Use' },
]

export const PAYMENT_PERIODS = [
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'QUARTERLY', label: 'Quarterly (4 months)' },
  { value: 'SEMI_ANNUAL', label: 'Semi-Annual (6 months)' },
  { value: 'ANNUAL', label: 'Annual (1 year)' },
]

export const UNIT_STATUSES = [
  { value: 'VACANT', label: 'Vacant' },
  { value: 'OCCUPIED', label: 'Occupied' },
  { value: 'MAINTENANCE', label: 'Under Maintenance' },
]

export const INVOICE_STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

export const UNIT_TYPES = [
  'Studio',
  '1-Bedroom',
  '2-Bedroom',
  '3-Bedroom',
  '4-Bedroom',
  'Penthouse',
  'Office',
  'Shop',
  'Warehouse',
  'Other',
]

export const PLAN_LIMITS = {
  FREE: 1,
  STANDARD: 10,
  PREMIUM: Infinity,
}

export const PLANS = [
  {
    key: 'FREE',
    name: 'Free',
    price: 0,
    priceLabel: 'Free forever',
    features: ['1 property', 'Basic rent tracking', 'Basic reminders', 'Up to 5 tenants'],
  },
  {
    key: 'STANDARD',
    name: 'Standard',
    price: 50000,
    priceLabel: 'UGX 50,000/month',
    features: [
      'Up to 10 properties',
      'Full invoicing & receipts',
      'PDF generation',
      'Email & SMS notifications',
      'Monthly reports',
      'Expense tracking',
    ],
  },
  {
    key: 'PREMIUM',
    name: 'Premium',
    price: 150000,
    priceLabel: 'UGX 150,000/month',
    features: [
      'Unlimited properties',
      'All Standard features',
      'Multi-manager support',
      'Advanced analytics',
      'API access',
      'Priority support',
      'Custom branding',
    ],
  },
]

export const COUNTRIES = [
  { value: 'US', label: 'United States', currency: 'USD' },
  { value: 'GB', label: 'United Kingdom', currency: 'GBP' },
  { value: 'CA', label: 'Canada', currency: 'CAD' },
  { value: 'AU', label: 'Australia', currency: 'AUD' },
  { value: 'DE', label: 'Germany', currency: 'EUR' },
  { value: 'FR', label: 'France', currency: 'EUR' },
  { value: 'AE', label: 'UAE', currency: 'AED' },
  { value: 'NG', label: 'Nigeria', currency: 'NGN' },
  { value: 'ZA', label: 'South Africa', currency: 'ZAR' },
  { value: 'GH', label: 'Ghana', currency: 'GHS' },
  { value: 'KE', label: 'Kenya', currency: 'KES' },
  { value: 'TZ', label: 'Tanzania', currency: 'TZS' },
  { value: 'UG', label: 'Uganda', currency: 'UGX' },
  { value: 'RW', label: 'Rwanda', currency: 'RWF' },
  { value: 'IN', label: 'India', currency: 'INR' },
  { value: 'OTHER', label: 'Other', currency: 'USD' },
]
