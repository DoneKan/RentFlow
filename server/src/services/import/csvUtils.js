const { parse } = require('csv-parse/sync');
const ApiError = require('../../utils/ApiError');

const MAX_DATA_ROWS = 5000;

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

// Normalizes a header cell for matching: trims, lowercases, and collapses
// internal whitespace, so "Property  Name", "property name", and
// " Property Name " all resolve to the same canonical key.
function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Parses an uploaded CSV buffer against a canonical column spec, handling
// every file-level edge case up front (empty file, unparseable content,
// missing required columns, zero data rows, oversized files) so entity
// importers only ever see well-formed rows.
//
// `columns` is [{ key, header, required }] — `key` is the canonical field
// name importer code reads (e.g. row.name), `header` is the expected CSV
// column title.
function parseImportCsv(buffer, columns) {
  if (!buffer || buffer.length === 0) {
    throw ApiError.badRequest('The uploaded file is empty. Please upload a CSV file with data.');
  }

  // A lone UTF-8 BOM, or a file of only whitespace/blank lines, parses to
  // zero records — indistinguishable from "truly empty" for our purposes.
  let records;
  try {
    records = parse(buffer, {
      bom: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch {
    throw ApiError.badRequest("This file doesn't look like a valid CSV. Please check the format and try again.");
  }

  if (records.length === 0) {
    throw ApiError.badRequest('The uploaded file is empty. Please upload a CSV file with data.');
  }

  const headerRow = records[0].map(normalizeHeader);
  const headerIndex = new Map();
  headerRow.forEach((h, i) => {
    if (!headerIndex.has(h)) headerIndex.set(h, i);
  });

  const missing = columns
    .filter((c) => c.required && !headerIndex.has(normalizeHeader(c.header)))
    .map((c) => c.header);

  if (missing.length > 0) {
    throw ApiError.badRequest(
      `The file is missing required column(s): ${missing.join(', ')}. Download the template to see the expected format.`
    );
  }

  const recognizedHeaders = new Set(columns.map((c) => normalizeHeader(c.header)));
  const ignoredColumns = records[0].filter((h) => !recognizedHeaders.has(normalizeHeader(h)));

  const dataRows = records.slice(1);

  if (dataRows.length === 0) {
    return { rows: [], ignoredColumns, isEmpty: true };
  }

  if (dataRows.length > MAX_DATA_ROWS) {
    throw ApiError.badRequest(
      `This file has ${dataRows.length} rows, which exceeds the ${MAX_DATA_ROWS.toLocaleString()}-row limit per import. Please split it into multiple files and upload them separately.`
    );
  }

  const rows = dataRows.map((raw, i) => {
    const fields = {};
    for (const c of columns) {
      const idx = headerIndex.get(normalizeHeader(c.header));
      fields[c.key] = idx === undefined ? '' : (raw[idx] ?? '').trim();
    }
    return { rowNumber: i + 2, fields }; // +2: 1-indexed, plus the header row itself
  });

  return { rows, ignoredColumns, isEmpty: false };
}

module.exports = { toCsv, csvCell, parseImportCsv, normalizeHeader, MAX_DATA_ROWS };
