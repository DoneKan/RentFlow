# Development Notes — AppFolio Parity Features

**Date:** 2026-07-31

## Why

We benchmarked RentFlow against AppFolio Property Manager to figure out
pricing and positioning. AppFolio prices per-unit with a $280–$1,500/month
floor and a 50-unit minimum on its Core tier — a model built for large US
portfolios that structurally excludes the individual landlords and small
agencies we're actually selling to in Uganda and East Africa.

The gap analysis showed real feature holes though: no owner portal, no
vendor/work-order management, no e-signature on leases, no tenant screening
or leasing pipeline, no photo inspections, no budgeting, and no real
accounting ledger. This round of work closes those gaps.

Deliberately out of scope for now: a native mobile app (different tech stack
entirely), listing syndication (no local equivalent of Zillow/Apartments.com
exists yet to integrate with), a public API (no third-party consumers yet),
and AI-agent automation (a retention feature for a mature installed base, not
a day-one need).

## What shipped

**Owner portal** — new `OWNER` role, separate from `LANDLORD`. Owners get a
read-mostly view of their properties, occupancy, income/expense summary, and
monthly statements per property, without full admin access.

**Vendor management** — a vendor directory (plumbing, electrical, cleaning,
etc.) that maintenance requests can be assigned to, with cost and notes
captured when a job is marked complete.

**E-signature & lease documents** — leases are generated as PDFs and sent to
the tenant portal for review. Tenants sign with a drawn signature (canvas-based,
no third-party e-sign vendor), which gets stamped into the final PDF.

**Leasing CRM + tenant screening** — merged into a single `Prospect` pipeline
(new → contacted → showing scheduled → screening → approved/rejected →
converted/lost) rather than treating screening as a separate system. Screening
is a manual, staff-recorded checklist (ID, employer, income, previous
landlord reference) — no credit-bureau integration exists for this market yet.
Approved prospects convert directly into a tenancy.

**Photo-based inspections** — move-in/move-out/routine inspections with a
per-area checklist (condition + notes + photos), and a generated PDF report.

**Budgeting & forecasting** — planned vs. actual reports per property and
category, comparing budget lines against real expense and payment data.

**General ledger / chart of accounts** — cash-basis double-entry bookkeeping.
Journal entries post automatically off real money movement (a completed
payment, a logged expense) rather than off invoice creation, since that's
how landlords in this market actually keep books. A default chart of
accounts (Cash, Bank, Mobile Money Clearing, Rental Income, one account per
expense category) is seeded automatically for every new organization.

## Architecture notes

- Every new module follows the existing pattern: Joi-validated Express
  routes → thin controllers using Prisma directly → `{success, message,
  data}` response envelope. No new abstractions introduced.
- All new "enum" fields (stage, status, category, condition) are plain
  strings with defaults, matching how the rest of the schema already works —
  not native Prisma enums.
- Every query is scoped by `organizationId`, either directly or by walking a
  relation (e.g. expense → property → organizationId), matching the
  multi-tenancy pattern already in place.
- Journal posting (`server/src/utils/ledgerPoster.js`) is fire-and-forget and
  no-ops silently if an org hasn't seeded a chart of accounts yet — it will
  never block a payment or expense from being recorded.
- `ProtectedRoute` on the client now accepts an `allowedRoles` prop, used on
  `/portal` and `/owner-portal`, closing a gap where any authenticated user
  could previously reach any route by URL.

## Local dev

Production still runs on Postgres (see `docker-compose.yml`). Locally, the
Prisma datasource can be pointed at either Postgres or SQLite via
`DATABASE_URL` in `server/.env` — SQLite is the fastest way to get a working
local database with zero setup:

```bash
cd server
npx prisma db push      # syncs schema, no Docker required
npx prisma db seed      # populates demo data, including the new modules
npm run dev              # from repo root
```

Demo logins after seeding:

| Role | Email | Password |
|---|---|---|
| Admin | admin@rentflow.ug | Admin@1234 |
| Manager | manager@rentflow.ug | Manager@1234 |
| Tenant | tenant@rentflow.ug | Tenant@1234 |
| Owner | owner@rentflow.ug | Owner@1234 |
