# RentFlow — Property Management System

> Built for Uganda. Ready for East Africa.

RentFlow is a web and mobile property management platform built for landlords, property managers, and agents in Uganda and East Africa. It solves the core pain points of manual rent collection, expense tracking, tenant communication, and financial reporting — with full support for local currencies, mobile money payments, and regional tax compliance.

---

## Table of Contents

- [Problem Statement](#problem-statement)
- [Target Users](#target-users)
- [Core Features](#core-features)
- [Business Model](#business-model)
- [Competitive Positioning](#competitive-positioning)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Git Workflow](#git-workflow)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [MVP Scope](#mvp-scope)
- [Future Features](#future-features)
- [Contributing](#contributing)
- [License](#license)

---

## Problem Statement

Most property managers in Uganda rely on spreadsheets, WhatsApp messages, and handwritten receipts to manage their properties. This leads to:

- Missed or late rent payments with no automated follow-up
- No clear record of expenses (utilities, security, maintenance, KCCA/URA taxes)
- No professional receipts or demand notices for tenants
- No monthly financial reports for property owners
- Difficulty managing multiple properties or units at scale
- Vacant properties with no easy way to advertise them

---

## Target Users

- **Landlords** — individual property owners with 1–50 units
- **Property managers / agents** — managing portfolios on behalf of owners
- **Organisations** — real estate companies managing commercial and residential properties
- **Tenants** — paying rent, viewing balances, raising maintenance requests

---

## Core Features

### 1. Onboarding & Setup
- Choose country during signup (Uganda default) with correct currency symbol (UGX)
- Company registration number field
- Property manager profile — individual or organisation, with contact information
- Each property assigned a unique **Property Code** on registration
  - Property codes are transferable in the event of a sale or commercial transaction

### 2. Property Management
- Add properties with full profile: type, location, amenities (e.g. 2-bedroom apartment, swimming pool, parking)
- Google Maps pin / property location tagging
- Add property manager, admin, or landlord's representative per property
- Set payment period per unit: monthly, 4 months, 6 months, or 1 year
- Ability to advertise vacant properties publicly — showing manager contact, area, Google pin, and amenities

### 3. Tenant & Rent Management
- Tenant profiles linked to units
- Flexible rent setup with additional charges showing itemised breakdown:
  - Utilities
  - Security
  - Garbage collection
  - Any custom additional charges
- Ability for manager to set and configure surcharges
- Calendar view highlighting:
  - Start of rental period
  - Duration
  - Due date
- Auto-invoicing triggered on due date
- Option to set late payment penalties

### 4. Payments
- Support for multiple payment channels:
  - MTN Mobile Money
  - Airtel Money
  - Bank transfer
  - Cash (manual entry)
- Auto-generated **payment receipts** sent to tenant on payment confirmation
- Payment proof downloadable as PDF

### 5. Expenses Tracking
- Dedicated **Expenses tab** on the dashboard
- Log and categorise property expenses:
  - Utilities
  - Security
  - Maintenance and repairs
  - KCCA taxes
  - URA taxes
  - Other custom categories
- Upload receipts or invoices per expense entry
- Real-time expense summaries per property

### 6. Notifications & Communication
- Automated **rent reminders** before due date
- **Demand notices** for overdue rent — sent via email and SMS
- Receipts sent automatically via email on payment
- In-app notifications for all key events
- Maintenance request system for tenants

### 7. Reporting
- **Monthly financial report** auto-generated and sent to property manager at month end:
  - Total rent collected
  - Outstanding balances
  - Expense breakdown
  - Net income per property
- Export reports as PDF or CSV
- Portfolio-level performance dashboard

### 8. Dashboard
- Unified dashboard for all properties, units, tenants, and financials
- Occupancy rates at a glance
- Revenue vs expense summaries
- Outstanding payments and overdue notices
- Quick actions: add tenant, record payment, log expense, generate report

---

## Business Model

### Subscription (SaaS)

| Plan | Target | Price (UGX/month) | Features |
|------|--------|-------------------|----------|
| Free | 1 property, basic features | 0 | Rent tracking, basic reminders |
| Standard | Individual landlords, up to 10 units | 50,000 | Full features, reports, receipts |
| Premium | Agencies, unlimited units | 150,000 | Analytics, multi-manager, API access, priority support |

- Monthly and yearly billing (discount for annual commitment)
- Per-unit pricing option for large portfolios

---

## Competitive Positioning

Global competitors (Buildium, TenantCloud, DoorLoop) are not built for Uganda:
- No MTN/Airtel Mobile Money integration
- No KCCA/URA tax support
- Priced in USD — unaffordable for local landlords
- Not optimised for East African rental structures

**RentFlow wins on:**
- Built for Uganda first (currency, taxes, mobile money, language)
- Affordable local pricing in UGX
- Simple enough for a first-time landlord
- Powerful enough for a 50-unit agency

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend (web) | React + Vite + TailwindCSS |
| Frontend (mobile) | React Native or Progressive Web App (PWA) |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT + role-based access control |
| Payments | MTN Mobile Money API, Airtel Money API |
| SMS / Email | Africa's Talking |
| Maps | Google Maps API |
| File storage | AWS S3 or Cloudinary |
| PDF generation | Puppeteer or pdfkit |
| Hosting | Railway, Render, or AWS |
| CI/CD | GitHub Actions |

---

## Project Structure

```
rentflow/
├── client/                  # React frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route-level pages
│   │   ├── hooks/           # Custom React hooks
│   │   ├── context/         # Global state (auth, theme)
│   │   ├── services/        # API call functions
│   │   ├── utils/           # Helpers and formatters
│   │   └── App.jsx
│   ├── .env.local
│   └── package.json
│
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── controllers/     # Request handlers
│   │   ├── routes/          # API route definitions
│   │   ├── middleware/       # Auth, error handling, validation
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Helpers (PDF, email, SMS)
│   │   ├── jobs/            # Scheduled jobs (auto-invoicing, reminders)
│   │   └── app.js
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── .env
│   └── package.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml           # Run tests on pull requests
│       └── deploy.yml       # Deploy on merge to main
│
├── .gitignore
├── docker-compose.yml       # Local dev with PostgreSQL
├── README.md
└── package.json             # Root scripts
```

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [PostgreSQL](https://www.postgresql.org/) v14 or higher (or use Docker)
- [Git](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/rentflow.git
cd rentflow
```

### 2. Install dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

### 3. Set up the database

Using Docker (recommended for local dev):

```bash
# From root directory
docker-compose up -d
```

Or manually create a PostgreSQL database named `rentflow_dev`.

### 4. Configure environment variables

Copy the example files and fill in your values:

```bash
cp server/.env.example server/.env
cp client/.env.local.example client/.env.local
```

See [Environment Variables](#environment-variables) section below.

### 5. Run database migrations

```bash
cd server
npx prisma migrate dev --name init
npx prisma generate
```

### 6. Seed the database (optional)

```bash
cd server
npx prisma db seed
```

### 7. Start the development servers

```bash
# From root — starts both client and server concurrently
npm run dev
```

Or individually:

```bash
# Terminal 1 — backend
cd server && npm run dev

# Terminal 2 — frontend
cd client && npm run dev
```

- Frontend runs on: `http://localhost:5173`
- Backend API runs on: `http://localhost:3000`

---

## Git Workflow

### Branching Strategy

We use **Git Flow**:

```
main          — production-ready code only. Never commit directly.
develop       — integration branch. All features merge here first.
feature/*     — new features branched from develop
fix/*         — bug fixes branched from develop
hotfix/*      — urgent production fixes branched from main
release/*     — release preparation branched from develop
```

### Branch naming

```bash
# Features
git checkout -b feature/tenant-dashboard
git checkout -b feature/mtn-mobile-money-integration
git checkout -b feature/auto-invoice-cron-job

# Bug fixes
git checkout -b fix/receipt-pdf-formatting
git checkout -b fix/login-token-expiry

# Hotfixes
git checkout -b hotfix/payment-gateway-timeout
```

### Commit message convention

We follow **Conventional Commits**:

```
<type>(<scope>): <short description>

Types:
  feat      — new feature
  fix       — bug fix
  docs      — documentation only
  style     — formatting, no logic change
  refactor  — code restructure, no feature change
  test      — adding or updating tests
  chore     — build process, dependencies, config
```

Examples:

```bash
git commit -m "feat(auth): add JWT role-based access control"
git commit -m "feat(payments): integrate MTN Mobile Money API"
git commit -m "fix(invoicing): correct due date calculation for 6-month periods"
git commit -m "docs(readme): add git workflow and project structure"
git commit -m "chore(deps): upgrade prisma to v5"
```

### Pull Request process

1. Branch off `develop`
2. Make your changes with clear commits
3. Push your branch and open a Pull Request to `develop`
4. PR must pass all CI checks before merging
5. At least one review required before merge
6. Squash and merge — keep history clean

```bash
# Push your feature branch
git push origin feature/tenant-dashboard

# Keep your branch up to date with develop
git fetch origin
git rebase origin/develop
```

### Releasing to production

```bash
# Cut a release branch from develop
git checkout -b release/v1.0.0 develop

# After QA sign-off, merge to main and tag
git checkout main
git merge release/v1.0.0
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main --tags

# Merge back to develop
git checkout develop
git merge release/v1.0.0
```

---

## Environment Variables

### Server (`server/.env`)

```env
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/rentflow_dev

# Authentication
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# MTN Mobile Money
MTN_API_URL=https://sandbox.momodeveloper.mtn.com
MTN_SUBSCRIPTION_KEY=your_mtn_subscription_key
MTN_API_USER=your_mtn_api_user
MTN_API_KEY=your_mtn_api_key
MTN_ENVIRONMENT=sandbox

# Airtel Money
AIRTEL_API_URL=https://openapi.airtel.africa
AIRTEL_CLIENT_ID=your_airtel_client_id
AIRTEL_CLIENT_SECRET=your_airtel_client_secret
AIRTEL_ENVIRONMENT=sandbox

# Africa's Talking (SMS + Email)
AT_API_KEY=your_africastalking_api_key
AT_USERNAME=your_africastalking_username
AT_SENDER_ID=RentFlow

# Google Maps
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=af-south-1
AWS_S3_BUCKET=rentflow-uploads

# Email (SMTP fallback)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Client (`client/.env.local`)

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_APP_NAME=RentFlow
VITE_DEFAULT_CURRENCY=UGX
VITE_DEFAULT_COUNTRY=UG
```

---

## API Overview

All API endpoints are prefixed with `/api/v1`

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

### Properties
```
GET    /api/v1/properties
POST   /api/v1/properties
GET    /api/v1/properties/:id
PUT    /api/v1/properties/:id
DELETE /api/v1/properties/:id
GET    /api/v1/properties/:id/units
GET    /api/v1/properties/vacant        # Public listing of vacant units
```

### Tenants
```
GET    /api/v1/tenants
POST   /api/v1/tenants
GET    /api/v1/tenants/:id
PUT    /api/v1/tenants/:id
DELETE /api/v1/tenants/:id
```

### Invoices
```
GET    /api/v1/invoices
POST   /api/v1/invoices
GET    /api/v1/invoices/:id
POST   /api/v1/invoices/:id/send
POST   /api/v1/invoices/:id/remind
```

### Payments
```
GET    /api/v1/payments
POST   /api/v1/payments
GET    /api/v1/payments/:id
GET    /api/v1/payments/:id/receipt     # Download PDF receipt
POST   /api/v1/payments/mtn/initiate
POST   /api/v1/payments/airtel/initiate
POST   /api/v1/payments/webhook/mtn
POST   /api/v1/payments/webhook/airtel
```

### Expenses
```
GET    /api/v1/expenses
POST   /api/v1/expenses
GET    /api/v1/expenses/:id
PUT    /api/v1/expenses/:id
DELETE /api/v1/expenses/:id
```

### Reports
```
GET    /api/v1/reports/monthly          # Monthly summary report
GET    /api/v1/reports/property/:id     # Per-property report
GET    /api/v1/reports/export           # Export CSV or PDF
```

---

## MVP Scope

Build these flows first — in this order:

1. Landlord/manager signup and property setup
2. Add tenants and assign to units
3. Set rent amount, payment period, and due date
4. Auto-invoice generation on due date (cron job)
5. Record payment and auto-generate receipt (PDF)
6. Send reminders and demand notices via email/SMS
7. Basic dashboard — income, outstanding, occupancy
8. Monthly report generation and delivery

Everything else is post-MVP.

---

## Future Features

- AI-powered rent trend insights and portfolio analytics
- Tenant screening and background checks
- Maintenance request tracking with vendor management
- Integration with accounting software (QuickBooks, Xero)
- Multi-language support (Luganda, Swahili)
- IoT property monitoring (smart locks, utility meters)
- Public property listing marketplace for vacant units
- Android and iOS native apps

---

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "feat(scope): add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request to `develop`

Please follow the commit conventions and branching strategy described above.

---

## License

This project is licensed under the MIT License. See `LICENSE` for details.

---

*RentFlow — Built for Uganda. Ready for East Africa.*
