# Roles & Account Creation

How a `User` row gets its `role`, and how that role is actually enforced.
`role` is a plain string column (`server/prisma/schema.prisma`) — there is
no separate permissions table; every route just checks role membership
against an allowlist.

## The five staff roles

`SUPER_ADMIN`, `ADMIN`, `PROPERTY_MANAGER`, `LANDLORD`, `ACCOUNTANT` — plus
`TENANT` (portal-only, created via Add Tenant, not either flow below) and
`OWNER` (portal-only, no self-service creation path exists yet at all).

Functionally, `ADMIN`/`PROPERTY_MANAGER`/`LANDLORD` are close to
identical — the only place they're ever treated differently is property
deletion, which is Admin/Super Admin only
(`server/src/routes/property.routes.js`). `ACCOUNTANT` is the one role with
a genuinely different permission set: full read+write on Payments and
Expenses, read-only on Invoices/Reports/Chart of Accounts/Budgets/Expense
Reminders, and no access at all to Properties/Tenants/Units/Maintenance.

## Two ways an account gets created — roles are handled completely differently

### 1. Self-service signup — `/register` → `POST /auth/register`

**No role choice exists in this form.** `auth.controller.js: register()`
hardcodes it:

```js
const user = await tx.user.create({
  data: { name, email, password: hashed, phone, role: 'ADMIN', organizationId: org.id },
});
```

Every signup also creates a **brand-new Organization** in the same
transaction. This flow only ever means "I'm starting a new business on
RentFlow" — the signer-up is unconditionally `ADMIN` of their own fresh
org. There is no way to sign up *into* an existing org through this form.

### 2. Invitation — the only way a second person joins an *existing* org

- An existing `ADMIN`/`SUPER_ADMIN` goes to **Settings → Team**, picks an
  email and a role (`ADMIN` / `PROPERTY_MANAGER` / `LANDLORD` /
  `ACCOUNTANT` — `SUPER_ADMIN` is deliberately excluded from this list),
  and sends the invite (`invitation.controller.js: create()`).
- The invitee gets an email with a link to `/accept-invite?token=...`,
  sets their name and password, and `invitation.controller.js: accept()`
  creates their `User` row with `role: invitation.role` and
  `organizationId: invitation.organizationId` — exactly the role the
  Admin picked, in the *same* org as the inviter.
- Same security shape as the existing password-reset flow: the raw token
  is only ever emailed, never stored — only its SHA-256 hash is
  (`Invitation.tokenHash`) — single-use, 7-day expiry.
- Only `ADMIN`/`SUPER_ADMIN` can send/list/revoke invites — deliberately
  narrower than the `STAFF_ROLES` set used for day-to-day operations,
  since handing out org access is a higher-trust action.

Existing members can be managed the same way — role changed or
deactivated — via `GET/PUT /team` (`team.controller.js`), same
`ADMIN`-tier gating. Two safety guards live there: an Admin can't change
their own role/status through that endpoint, and the system refuses to
demote or deactivate an org's last active Admin/Super Admin.

## Two roles that live outside both flows

- **`SUPER_ADMIN`** — platform-level. Not assignable via signup or invite;
  only exists if set directly in the database. Meant for internal access,
  not something a customer's own Admin should be able to grant.
- **`TENANT`** — created via the Add Tenant form by staff
  (`tenant.controller.js: create()`), never via `/register` or an invite.

## How enforcement actually works

Every protected route is wrapped in `authorize(...roles)`
(`server/src/middleware/auth.js`) — a plain `roles.includes(req.user.role)`
check, `req.user.role` coming straight from the JWT payload set at login.
Each route file defines its own allowed-roles array(s) and applies them
per-route (or via a blanket `router.use()` where every method in the file
needs the same access). There is no dynamic/DB-driven permission system —
changing what a role can do means editing the `authorize()` calls in the
relevant route file directly.
