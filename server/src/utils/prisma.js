const { PrismaClient } = require('@prisma/client');

// Caps how many connections this process can open, enforced here rather
// than trusting DATABASE_URL to already carry it — so a misconfigured or
// Railway-managed connection string can't silently exhaust Postgres's
// connection limit, including across retries/reconnects. Only meaningful
// for Postgres/MySQL; SQLite (local dev/tests, `file:...`) doesn't pool
// connections this way and is left untouched.
function withConnectionLimit(url) {
  if (!url || !/^(postgres(ql)?|mysql):\/\//.test(url)) return url;
  if (/[?&]connection_limit=/.test(url)) return url;
  const limit = process.env.DATABASE_CONNECTION_LIMIT || '5';
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=${limit}`;
}

// Single shared client for the whole process. Every controller/job/util
// must require this instead of calling `new PrismaClient()` itself — each
// instance opens its own connection pool, and 20+ separate instances
// across the codebase was exhausting Postgres's connection limit on
// deploy ("too many clients already").
const prisma = new PrismaClient({
  datasources: { db: { url: withConnectionLimit(process.env.DATABASE_URL) } },
});

module.exports = prisma;
