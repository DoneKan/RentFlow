const PDFDocument = require('pdfkit');
const { formatCurrency, formatDate } = require('./format');

const BRAND_BLUE = '#1e3a5f';
const BRAND_LIGHT = '#e8f0fe';
const TEXT_DARK = '#1a1a2e';
const TEXT_MUTED = '#6b7280';

function drawHeader(doc, title) {
  doc.rect(0, 0, doc.page.width, 80).fill(BRAND_BLUE);
  doc.fillColor('white').fontSize(24).font('Helvetica-Bold').text('RentFlow', 40, 20);
  doc.fontSize(10).font('Helvetica').fillColor('#a0c4ff').text('Property Management System', 40, 48);
  doc.fillColor('white').fontSize(14).font('Helvetica-Bold').text(title, 0, 30, {
    align: 'right',
    width: doc.page.width - 40,
  });
  doc.moveDown(4);
}

function drawDivider(doc) {
  const y = doc.y;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).strokeColor('#e5e7eb').lineWidth(1).stroke();
  doc.moveDown(0.5);
}

function drawLabelValue(doc, label, value, x = 40, width = 240) {
  const startY = doc.y;
  doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica').text(label, x, startY);
  doc.fillColor(TEXT_DARK).fontSize(11).font('Helvetica-Bold').text(value, x, startY + 14, { width });
  doc.y = startY + 34;
}

async function generateReceipt(payment, invoice, tenant, unit, property) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'PAYMENT RECEIPT');

    // PAID stamp
    doc.save();
    doc.rotate(-30, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.fillColor('#00b04f').opacity(0.08).fontSize(100).font('Helvetica-Bold')
      .text('PAID', 80, 280, { width: 500, align: 'center' });
    doc.restore();
    doc.opacity(1);

    // Receipt info block
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Receipt Details', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const col1 = 40;
    const col2 = 320;

    const savedY = doc.y;
    drawLabelValue(doc, 'Receipt Number', payment.receiptNumber, col1);
    doc.y = savedY;
    drawLabelValue(doc, 'Date Issued', formatDate(new Date()), col2);

    const savedY2 = doc.y;
    drawLabelValue(doc, 'Payment Date', formatDate(payment.paidAt || new Date()), col1);
    doc.y = savedY2;
    drawLabelValue(doc, 'Invoice Number', invoice.invoiceNumber, col2);

    drawDivider(doc);

    // Tenant & property info
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Tenant & Property', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const savedY3 = doc.y;
    drawLabelValue(doc, 'Tenant Name', tenant.name, col1);
    doc.y = savedY3;
    drawLabelValue(doc, 'Property', property.name, col2);

    const savedY4 = doc.y;
    drawLabelValue(doc, 'Email', tenant.email, col1);
    doc.y = savedY4;
    drawLabelValue(doc, 'Unit', `Unit ${unit.unitNumber}`, col2);

    drawDivider(doc);

    // Payment details
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Payment Details', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const methodLabels = {
      MTN_MOMO: 'MTN Mobile Money',
      AIRTEL_MONEY: 'Airtel Money',
      BANK_TRANSFER: 'Bank Transfer',
      CASH: 'Cash',
    };

    const savedY5 = doc.y;
    drawLabelValue(doc, 'Payment Method', methodLabels[payment.method] || payment.method, col1);
    doc.y = savedY5;
    if (payment.transactionId) {
      drawLabelValue(doc, 'Transaction ID', payment.transactionId, col2);
    } else if (payment.mobileNumber) {
      drawLabelValue(doc, 'Mobile Number', payment.mobileNumber, col2);
    }

    // Amount box
    doc.moveDown(1);
    const amountBoxY = doc.y;
    doc.rect(40, amountBoxY, doc.page.width - 80, 60).fill(BRAND_LIGHT);
    doc.fillColor(TEXT_MUTED).fontSize(11).font('Helvetica').text('AMOUNT PAID', 60, amountBoxY + 12);
    doc.fillColor(BRAND_BLUE).fontSize(22).font('Helvetica-Bold')
      .text(formatCurrency(payment.amount, payment.currency || 'UGX'), 60, amountBoxY + 28);
    doc.y = amountBoxY + 70;

    // Footer
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill(BRAND_BLUE);
    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text('This is a computer-generated receipt and is valid without a signature.', 40, footerY + 15, {
        align: 'center',
        width: doc.page.width - 80,
      });
    doc.fillColor('#a0c4ff').fontSize(8)
      .text('RentFlow — Built for Uganda. Ready for East Africa. | www.rentflow.ug', 40, footerY + 35, {
        align: 'center',
        width: doc.page.width - 80,
      });

    doc.end();
  });
}

async function generateInvoice(invoice, tenant, unit, property) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, 'INVOICE');

    // Invoice metadata
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Invoice Details', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const col1 = 40;
    const col2 = 320;

    const savedY = doc.y;
    drawLabelValue(doc, 'Invoice Number', invoice.invoiceNumber, col1);
    doc.y = savedY;
    drawLabelValue(doc, 'Status', invoice.status, col2);

    const savedY2 = doc.y;
    drawLabelValue(doc, 'Issue Date', formatDate(invoice.createdAt || new Date()), col1);
    doc.y = savedY2;
    drawLabelValue(doc, 'Due Date', formatDate(invoice.dueDate), col2);

    drawDivider(doc);

    // Billed to
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Billed To', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const savedY3 = doc.y;
    drawLabelValue(doc, 'Tenant', tenant.name, col1);
    doc.y = savedY3;
    drawLabelValue(doc, 'Property', property.name, col2);

    const savedY4 = doc.y;
    drawLabelValue(doc, 'Email', tenant.email, col1);
    doc.y = savedY4;
    drawLabelValue(doc, 'Unit', `Unit ${unit.unitNumber}`, col2);

    drawDivider(doc);

    // Items table
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Charges Breakdown', 40, doc.y);
    doc.moveDown(0.4);

    // Table header
    const tableY = doc.y;
    doc.rect(40, tableY, doc.page.width - 80, 24).fill(BRAND_BLUE);
    doc.fillColor('white').fontSize(10).font('Helvetica-Bold')
      .text('Description', 50, tableY + 7)
      .text('Amount', doc.page.width - 140, tableY + 7, { width: 100, align: 'right' });

    let rowY = tableY + 28;
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    items.forEach((item, i) => {
      if (i % 2 === 0) {
        doc.rect(40, rowY, doc.page.width - 80, 22).fill('#f9fafb');
      }
      doc.fillColor(TEXT_DARK).fontSize(10).font('Helvetica')
        .text(item.description || item.name, 50, rowY + 6)
        .text(formatCurrency(item.amount, invoice.currency || 'UGX'), doc.page.width - 140, rowY + 6, {
          width: 100,
          align: 'right',
        });
      rowY += 22;
    });

    if (invoice.latePenalty && Number(invoice.latePenalty) > 0) {
      doc.rect(40, rowY, doc.page.width - 80, 22).fill('#fff3f3');
      doc.fillColor('#dc2626').fontSize(10).font('Helvetica')
        .text('Late Payment Penalty', 50, rowY + 6)
        .text(formatCurrency(invoice.latePenalty, invoice.currency || 'UGX'), doc.page.width - 140, rowY + 6, {
          width: 100,
          align: 'right',
        });
      rowY += 22;
    }

    doc.y = rowY + 8;
    drawDivider(doc);

    // Total
    const totalBoxY = doc.y;
    doc.rect(40, totalBoxY, doc.page.width - 80, 60).fill(BRAND_LIGHT);
    doc.fillColor(TEXT_MUTED).fontSize(11).font('Helvetica').text('TOTAL AMOUNT DUE', 60, totalBoxY + 12);
    doc.fillColor(BRAND_BLUE).fontSize(22).font('Helvetica-Bold')
      .text(formatCurrency(invoice.amount, invoice.currency || 'UGX'), 60, totalBoxY + 28);

    if (invoice.status === 'OVERDUE') {
      doc.fillColor('#dc2626').fontSize(12).font('Helvetica-Bold')
        .text('OVERDUE', doc.page.width - 140, totalBoxY + 20, { width: 80, align: 'center' });
    }

    doc.y = totalBoxY + 70;

    // Payment note
    doc.moveDown(1);
    doc.rect(40, doc.y, doc.page.width - 80, 50).fill('#fffbeb');
    const noteY = doc.y + 10;
    doc.fillColor('#92400e').fontSize(10).font('Helvetica-Bold').text('Payment Instructions:', 60, noteY);
    doc.fillColor('#78350f').fontSize(9).font('Helvetica')
      .text('Pay via MTN Mobile Money, Airtel Money, Bank Transfer, or Cash at the property office.', 60, noteY + 14, {
        width: doc.page.width - 100,
      });
    doc.y += 60;

    // Footer
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill(BRAND_BLUE);
    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text('This is a computer-generated invoice. For queries contact your property manager.', 40, footerY + 15, {
        align: 'center',
        width: doc.page.width - 80,
      });
    doc.fillColor('#a0c4ff').fontSize(8)
      .text('RentFlow — Built for Uganda. Ready for East Africa. | www.rentflow.ug', 40, footerY + 35, {
        align: 'center',
        width: doc.page.width - 80,
      });

    doc.end();
  });
}

// Renders the lease agreement PDF. When `signature` is supplied
// ({ dataUrl, signerName, signedAt }), the signature image is stamped onto
// the signature line and the document reads as executed; otherwise the line
// is left blank for a later signing pass.
async function generateLeaseAgreement(tenancy, unit, property, tenant, org, signature) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const currency = tenancy.currency || unit.currency || 'UGX';

    drawHeader(doc, 'LEASE AGREEMENT');

    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Parties', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const col1 = 40;
    const col2 = 320;

    const savedY = doc.y;
    drawLabelValue(doc, 'Landlord / Agency', org.name, col1);
    doc.y = savedY;
    drawLabelValue(doc, 'Tenant', tenant.name, col2);

    const savedY2 = doc.y;
    drawLabelValue(doc, 'Property', property.name, col1);
    doc.y = savedY2;
    drawLabelValue(doc, 'Unit', `Unit ${unit.unitNumber} (${unit.type})`, col2);

    drawDivider(doc);

    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Tenancy Terms', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const savedY3 = doc.y;
    drawLabelValue(doc, 'Start Date', formatDate(tenancy.startDate), col1);
    doc.y = savedY3;
    drawLabelValue(doc, 'End Date', tenancy.endDate ? formatDate(tenancy.endDate) : 'Month-to-month', col2);

    const savedY4 = doc.y;
    drawLabelValue(doc, 'Monthly Rent', formatCurrency(tenancy.rentAmount, currency), col1);
    doc.y = savedY4;
    drawLabelValue(doc, 'Security Deposit', formatCurrency(tenancy.depositAmount || 0, currency), col2);

    drawDivider(doc);

    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Terms & Conditions', 40, doc.y);
    doc.moveDown(0.5);
    const terms = [
      'Rent is due on or before the 1st day of each rental period, in the currency stated above.',
      'A late payment penalty applies after the agreed grace period, as set out in the tenant portal.',
      'The security deposit is refundable at the end of the tenancy, subject to a move-out inspection.',
      'The tenant agrees to report maintenance issues promptly through the tenant portal.',
      'Either party may terminate this agreement per the notice period required by local law.',
    ];
    doc.fillColor(TEXT_DARK).fontSize(9.5).font('Helvetica');
    terms.forEach((t, i) => {
      doc.text(`${i + 1}. ${t}`, 40, doc.y, { width: doc.page.width - 80 });
      doc.moveDown(0.4);
    });

    doc.moveDown(1);
    drawDivider(doc);

    // Signature block
    const sigY = doc.y + 10;
    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Signature', 40, doc.y);
    doc.moveDown(1);

    const lineY = doc.y + 40;
    if (signature?.dataUrl) {
      try {
        const base64 = signature.dataUrl.split(',').pop();
        const imgBuffer = Buffer.from(base64, 'base64');
        doc.image(imgBuffer, 40, lineY - 45, { fit: [180, 50] });
      } catch {
        // Malformed signature data — leave the line blank rather than fail PDF generation
      }
    }
    doc.moveTo(40, lineY).lineTo(280, lineY).strokeColor('#9ca3af').lineWidth(1).stroke();
    doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica')
      .text(signature?.signerName ? signature.signerName : 'Tenant signature', 40, lineY + 6);
    if (signature?.signedAt) {
      doc.text(`Signed ${formatDate(signature.signedAt)}`, 40, lineY + 20);
    }

    doc.y = lineY + 40;

    // Footer
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill(BRAND_BLUE);
    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text(
        signature?.dataUrl
          ? 'This lease has been signed electronically and is binding between the parties.'
          : 'This lease is pending signature.',
        40, footerY + 15, { align: 'center', width: doc.page.width - 80 }
      );
    doc.fillColor('#a0c4ff').fontSize(8)
      .text('RentFlow — Built for Uganda. Ready for East Africa. | www.rentflow.ug', 40, footerY + 35, {
        align: 'center',
        width: doc.page.width - 80,
      });

    doc.end();
  });
}

const CONDITION_COLORS = {
  GOOD: '#16a34a',
  FAIR: '#d97706',
  POOR: '#ea580c',
  DAMAGED: '#dc2626',
};

async function generateInspectionReport(inspection) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, `${inspection.type.replace('_', ' ')} INSPECTION`);

    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Inspection Details', 40, doc.y);
    doc.moveDown(0.4);
    drawDivider(doc);

    const col1 = 40;
    const col2 = 320;

    const savedY = doc.y;
    drawLabelValue(doc, 'Property', inspection.property.name, col1);
    doc.y = savedY;
    drawLabelValue(doc, 'Status', inspection.status, col2);

    const savedY2 = doc.y;
    drawLabelValue(doc, 'Scheduled', inspection.scheduledDate ? formatDate(inspection.scheduledDate) : 'N/A', col1);
    doc.y = savedY2;
    drawLabelValue(doc, 'Completed', inspection.completedDate ? formatDate(inspection.completedDate) : 'Pending', col2);

    drawDivider(doc);

    doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Checklist', 40, doc.y);
    doc.moveDown(0.5);

    const items = inspection.items || [];
    if (items.length === 0) {
      doc.fillColor(TEXT_MUTED).fontSize(10).font('Helvetica').text('No checklist items recorded.', 40, doc.y);
      doc.moveDown(1);
    }

    items.forEach((item) => {
      if (doc.y > doc.page.height - 140) doc.addPage();

      const rowY = doc.y;
      doc.rect(40, rowY, doc.page.width - 80, 26).fill('#f9fafb');
      doc.fillColor(TEXT_DARK).fontSize(11).font('Helvetica-Bold').text(item.area, 50, rowY + 7);
      doc.fillColor(CONDITION_COLORS[item.condition] || TEXT_MUTED).fontSize(10).font('Helvetica-Bold')
        .text(item.condition, doc.page.width - 150, rowY + 8, { width: 100, align: 'right' });
      doc.y = rowY + 30;

      if (item.notes) {
        doc.fillColor(TEXT_MUTED).fontSize(9).font('Helvetica').text(item.notes, 50, doc.y, { width: doc.page.width - 100 });
        doc.moveDown(0.5);
      }

      const photos = item.photos || [];
      if (photos.length > 0) {
        doc.fillColor(TEXT_MUTED).fontSize(8).font('Helvetica')
          .text(`${photos.length} photo(s) attached — view in the RentFlow app.`, 50, doc.y);
        doc.moveDown(0.5);
      }
      doc.moveDown(0.3);
    });

    if (inspection.overallNotes) {
      drawDivider(doc);
      doc.fillColor(BRAND_BLUE).fontSize(13).font('Helvetica-Bold').text('Overall Notes', 40, doc.y);
      doc.moveDown(0.3);
      doc.fillColor(TEXT_DARK).fontSize(10).font('Helvetica').text(inspection.overallNotes, 40, doc.y, { width: doc.page.width - 80 });
    }

    // Footer
    const footerY = doc.page.height - 80;
    doc.rect(0, footerY, doc.page.width, 80).fill(BRAND_BLUE);
    doc.fillColor('white').fontSize(9).font('Helvetica')
      .text('This is a computer-generated inspection report.', 40, footerY + 15, {
        align: 'center',
        width: doc.page.width - 80,
      });
    doc.fillColor('#a0c4ff').fontSize(8)
      .text('RentFlow — Built for Uganda. Ready for East Africa. | www.rentflow.ug', 40, footerY + 35, {
        align: 'center',
        width: doc.page.width - 80,
      });

    doc.end();
  });
}

module.exports = { generateReceipt, generateInvoice, generateLeaseAgreement, generateInspectionReport };
