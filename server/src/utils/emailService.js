const nodemailer = require('nodemailer');
const logger = require('./logger');

function formatCurrency(amount, currency = 'UGX') {
  return `${currency} ${Number(amount).toLocaleString('en-UG', { minimumFractionDigits: 0 })}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-UG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const baseStyles = `
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f4f6f9; }
  .container { max-width: 600px; margin: 30px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #1e3a5f; padding: 28px 32px; }
  .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
  .header p { color: #a0c4ff; margin: 4px 0 0; font-size: 13px; }
  .body { padding: 32px; }
  .body h2 { color: #1e3a5f; margin-top: 0; }
  .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
  .info-label { color: #6b7280; font-size: 13px; }
  .info-value { color: #1a1a2e; font-weight: 600; font-size: 13px; }
  .amount-box { background: #e8f0fe; border-left: 4px solid #1e3a5f; padding: 16px 20px; border-radius: 4px; margin: 20px 0; }
  .amount-box .label { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .amount-box .amount { color: #1e3a5f; font-size: 26px; font-weight: 700; }
  .btn { display: inline-block; background: #1e3a5f; color: white; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 16px 0; }
  .warning-box { background: #fff3f3; border-left: 4px solid #dc2626; padding: 14px 18px; border-radius: 4px; margin: 16px 0; }
  .warning-box p { color: #7f1d1d; margin: 0; font-size: 13px; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e5e7eb; }
  .footer p { color: #9ca3af; font-size: 11px; margin: 4px 0; }
`;

async function sendEmail({ to, subject, html, text, attachments = [] }) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      logger.warn(`Email not sent (no SMTP config): ${subject} to ${to}`);
      return { success: false, reason: 'No SMTP configuration' };
    }

    const transporter = createTransporter();
    const from = process.env.SMTP_FROM || 'RentFlow <noreply@rentflow.ug>';

    const info = await transporter.sendMail({ from, to, subject, html, text, attachments });
    logger.info(`Email sent: ${subject} → ${to} [${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    logger.error(`Email send failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

async function sendWelcomeEmail(user) {
  const loginUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`;
  const html = `
    <style>${baseStyles}</style>
    <div class="container">
      <div class="header"><h1>RentFlow</h1><p>Property Management System</p></div>
      <div class="body">
        <h2>Welcome to RentFlow, ${user.name}!</h2>
        <p>Your account has been created successfully. You can now log in and start managing your properties.</p>
        <div class="info-row"><span class="info-label">Email</span><span class="info-value">${user.email}</span></div>
        <div class="info-row"><span class="info-label">Role</span><span class="info-value">${user.role.replace('_', ' ')}</span></div>
        <br/>
        <a href="${loginUrl}" class="btn">Login to RentFlow</a>
        <p style="color:#6b7280;font-size:12px;">If you did not create this account, please ignore this email.</p>
      </div>
      <div class="footer"><p>RentFlow — Built for Uganda. Ready for East Africa.</p><p>© ${new Date().getFullYear()} RentFlow</p></div>
    </div>`;

  return sendEmail({ to: user.email, subject: 'Welcome to RentFlow!', html });
}

async function sendInvoiceEmail(tenant, invoice, unit, property, pdfBuffer) {
  const html = `
    <style>${baseStyles}</style>
    <div class="container">
      <div class="header"><h1>RentFlow</h1><p>Property Management System</p></div>
      <div class="body">
        <h2>Rent Invoice — ${property.name}</h2>
        <p>Dear ${tenant.name}, please find your rent invoice for <strong>Unit ${unit.unitNumber}</strong> at <strong>${property.name}</strong>.</p>
        <div class="info-row"><span class="info-label">Invoice Number</span><span class="info-value">${invoice.invoiceNumber}</span></div>
        <div class="info-row"><span class="info-label">Unit</span><span class="info-value">Unit ${unit.unitNumber}, ${property.name}</span></div>
        <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${formatDate(invoice.dueDate)}</span></div>
        <div class="amount-box">
          <div class="label">Amount Due</div>
          <div class="amount">${formatCurrency(invoice.amount, invoice.currency)}</div>
        </div>
        <p>Please pay before the due date to avoid late payment penalties. You can pay via MTN Mobile Money, Airtel Money, Bank Transfer, or Cash.</p>
      </div>
      <div class="footer"><p>RentFlow — Built for Uganda. Ready for East Africa.</p></div>
    </div>`;

  return sendEmail({
    to: tenant.email,
    subject: `Invoice ${invoice.invoiceNumber} — ${formatCurrency(invoice.amount, invoice.currency)} due ${formatDate(invoice.dueDate)}`,
    html,
    attachments: pdfBuffer
      ? [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [],
  });
}

async function sendPaymentReceipt(tenant, payment, pdfBuffer) {
  const html = `
    <style>${baseStyles}</style>
    <div class="container">
      <div class="header"><h1>RentFlow</h1><p>Property Management System</p></div>
      <div class="body">
        <h2>Payment Received</h2>
        <p>Dear ${tenant.name}, we have received your payment. Please find your receipt attached.</p>
        <div class="info-row"><span class="info-label">Receipt Number</span><span class="info-value">${payment.receiptNumber}</span></div>
        <div class="info-row"><span class="info-label">Payment Date</span><span class="info-value">${formatDate(payment.paidAt || new Date())}</span></div>
        <div class="info-row"><span class="info-label">Payment Method</span><span class="info-value">${payment.method.replace('_', ' ')}</span></div>
        <div class="amount-box">
          <div class="label">Amount Paid</div>
          <div class="amount">${formatCurrency(payment.amount, payment.currency)}</div>
        </div>
        <p>Thank you for your payment. Your receipt is attached as a PDF for your records.</p>
      </div>
      <div class="footer"><p>RentFlow — Built for Uganda. Ready for East Africa.</p></div>
    </div>`;

  return sendEmail({
    to: tenant.email,
    subject: `Payment Receipt ${payment.receiptNumber} — ${formatCurrency(payment.amount, payment.currency)}`,
    html,
    attachments: pdfBuffer
      ? [{ filename: `${payment.receiptNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
      : [],
  });
}

async function sendRentReminder(tenant, invoice, unit, property) {
  const daysUntilDue = Math.ceil((new Date(invoice.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
  const html = `
    <style>${baseStyles}</style>
    <div class="container">
      <div class="header"><h1>RentFlow</h1><p>Property Management System</p></div>
      <div class="body">
        <h2>Rent Payment Reminder</h2>
        <p>Dear ${tenant.name}, this is a friendly reminder that your rent payment is due in <strong>${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}</strong>.</p>
        <div class="info-row"><span class="info-label">Property</span><span class="info-value">${property.name}</span></div>
        <div class="info-row"><span class="info-label">Unit</span><span class="info-value">Unit ${unit.unitNumber}</span></div>
        <div class="info-row"><span class="info-label">Invoice</span><span class="info-value">${invoice.invoiceNumber}</span></div>
        <div class="info-row"><span class="info-label">Due Date</span><span class="info-value">${formatDate(invoice.dueDate)}</span></div>
        <div class="amount-box">
          <div class="label">Amount Due</div>
          <div class="amount">${formatCurrency(invoice.amount, invoice.currency)}</div>
        </div>
        <p>Please arrange payment before the due date to avoid late payment penalties.</p>
      </div>
      <div class="footer"><p>RentFlow — Built for Uganda. Ready for East Africa.</p></div>
    </div>`;

  return sendEmail({
    to: tenant.email,
    subject: `Rent Reminder — Due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''} — ${property.name} Unit ${unit.unitNumber}`,
    html,
  });
}

async function sendDemandNotice(tenant, invoice, unit, property) {
  const daysOverdue = Math.ceil((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24));
  const html = `
    <style>${baseStyles}</style>
    <div class="container">
      <div class="header" style="background:#7f1d1d;"><h1>RentFlow</h1><p style="color:#fca5a5;">Property Management System</p></div>
      <div class="body">
        <h2 style="color:#dc2626;">DEMAND NOTICE — Overdue Rent</h2>
        <p>Dear ${tenant.name}, your rent payment for <strong>Unit ${unit.unitNumber}</strong> at <strong>${property.name}</strong> is now <strong>${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue</strong>.</p>
        <div class="warning-box">
          <p><strong>⚠ Immediate action required.</strong> Failure to pay may result in eviction proceedings in accordance with your tenancy agreement.</p>
        </div>
        <div class="info-row"><span class="info-label">Invoice Number</span><span class="info-value">${invoice.invoiceNumber}</span></div>
        <div class="info-row"><span class="info-label">Original Due Date</span><span class="info-value">${formatDate(invoice.dueDate)}</span></div>
        <div class="info-row"><span class="info-label">Days Overdue</span><span class="info-value" style="color:#dc2626;">${daysOverdue} days</span></div>
        <div class="amount-box" style="background:#fff3f3;border-color:#dc2626;">
          <div class="label">Total Amount Outstanding</div>
          <div class="amount" style="color:#dc2626;">${formatCurrency(invoice.amount, invoice.currency)}</div>
        </div>
        <p>Please pay immediately or contact your property manager to make arrangements. Continued non-payment will result in formal eviction proceedings.</p>
      </div>
      <div class="footer"><p>RentFlow — Built for Uganda. Ready for East Africa.</p></div>
    </div>`;

  return sendEmail({
    to: tenant.email,
    subject: `DEMAND NOTICE — Overdue Rent ${invoice.invoiceNumber} — ${property.name}`,
    html,
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendInvoiceEmail,
  sendPaymentReceipt,
  sendRentReminder,
  sendDemandNotice,
};
