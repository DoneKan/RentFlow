const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function pad(str, length) {
  return str.length >= length ? str : str + '0'.repeat(length - str.length);
}

async function generatePropertyCode(name) {
  const prefix = name
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .substring(0, 4);
  const paddedPrefix = pad(prefix, 4);

  let code;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 100) {
    const digits = String(Math.floor(Math.random() * 9000) + 1000);
    code = `${paddedPrefix}${digits}`;
    const found = await prisma.property.findUnique({ where: { code } });
    exists = !!found;
    attempts++;
  }

  if (exists) {
    throw new Error('Could not generate unique property code after 100 attempts');
  }

  return code;
}

function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `INV-${year}${month}-${rand}`;
}

function generateReceiptNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `RCP-${year}${month}-${rand}`;
}

module.exports = { generatePropertyCode, generateInvoiceNumber, generateReceiptNumber };
