const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const logger = require('../utils/logger');
const prisma = require('../utils/prisma');
const { getImporter } = require('../services/import/registry');
const { toCsv, parseImportCsv } = require('../services/import/csvUtils');

function requireImporter(req) {
  const importer = getImporter(req.params.entityType);
  if (!importer) throw ApiError.notFound(`Unknown import type "${req.params.entityType}"`);
  return importer;
}

function requireRole(importer, req) {
  if (!importer.allowedRoles.includes(req.user.role)) {
    throw ApiError.forbidden('Insufficient permissions to import this data');
  }
}

function rowToJson(fields, normalized) {
  return JSON.stringify({ raw: fields, normalized: normalized || null });
}

function parseRowData(row) {
  try {
    return JSON.parse(row.data);
  } catch {
    return { raw: {}, normalized: null };
  }
}

function downloadTemplate(req, res, next) {
  try {
    const importer = requireImporter(req);
    requireRole(importer, req);

    const rows = [importer.columns.map((c) => c.header), ...importer.templateRows];
    const csv = toCsv(rows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rentflow-${importer.key}-template.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function validateUpload(req, res, next) {
  try {
    const importer = requireImporter(req);
    requireRole(importer, req);

    if (!req.file) throw ApiError.badRequest('No file was uploaded.');

    const parsed = parseImportCsv(req.file.buffer, importer.columns);

    if (parsed.isEmpty) {
      const batch = await prisma.importBatch.create({
        data: {
          organizationId: req.user.organizationId,
          entityType: importer.entityType,
          fileName: req.file.originalname,
          status: 'PENDING',
          totalRows: 0,
          cleanCount: 0,
          warningCount: 0,
          errorCount: 0,
          createdById: req.user.id,
        },
      });
      return ApiResponse.success(res, {
        batchId: batch.id,
        fileName: batch.fileName,
        ignoredColumns: parsed.ignoredColumns,
        summary: { total: 0, clean: 0, warnings: 0, errors: 0 },
        preview: { clean: [], warnings: [], errors: [] },
        message: 'No data rows found in this file — nothing to import.',
      }, 'File parsed');
    }

    // Entities with a foreign-key lookup column (e.g. Units resolving a
    // "Property Name" to a propertyId) fetch the lookup table once here,
    // rather than importer.validateRow querying the DB per row — a single
    // query regardless of file size, up to the 5,000-row limit.
    const context = importer.prefetchContext
      ? await importer.prefetchContext(prisma, req.user.organizationId)
      : {};

    const validated = parsed.rows.map((row) => {
      const { normalized, errors } = importer.validateRow(row.fields, context, row.rowNumber);
      return { rowNumber: row.rowNumber, fields: row.fields, normalized, errors };
    });

    const errorRows = validated.filter((r) => r.errors.length > 0);
    const candidateRows = validated.filter((r) => r.errors.length === 0);

    const dupWarnings = importer.findDuplicateWarnings
      ? await importer.findDuplicateWarnings(prisma, req.user.organizationId, candidateRows)
      : new Map();

    const warningRows = candidateRows.filter((r) => dupWarnings.has(r.rowNumber));
    const cleanRows = candidateRows.filter((r) => !dupWarnings.has(r.rowNumber));

    const rowsToPersist = [
      ...cleanRows.map((r) => ({
        rowNumber: r.rowNumber,
        data: rowToJson(r.fields, r.normalized),
        bucket: 'CLEAN',
        reasons: JSON.stringify([]),
        included: true,
      })),
      ...warningRows.map((r) => ({
        rowNumber: r.rowNumber,
        data: rowToJson(r.fields, r.normalized),
        bucket: 'WARNING',
        reasons: JSON.stringify([dupWarnings.get(r.rowNumber)]),
        included: false,
      })),
      ...errorRows.map((r) => ({
        rowNumber: r.rowNumber,
        data: rowToJson(r.fields, null),
        bucket: 'ERROR',
        reasons: JSON.stringify(r.errors),
        included: false,
      })),
    ];

    const batch = await prisma.importBatch.create({
      data: {
        organizationId: req.user.organizationId,
        entityType: importer.entityType,
        fileName: req.file.originalname,
        status: 'PENDING',
        totalRows: validated.length,
        cleanCount: cleanRows.length,
        warningCount: warningRows.length,
        errorCount: errorRows.length,
        createdById: req.user.id,
        rows: { create: rowsToPersist },
      },
      include: { rows: true },
    });

    const toPreviewRow = (r) => ({
      id: r.id,
      rowNumber: r.rowNumber,
      data: parseRowData(r).raw,
      reasons: JSON.parse(r.reasons),
    });

    return ApiResponse.success(res, {
      batchId: batch.id,
      fileName: batch.fileName,
      ignoredColumns: parsed.ignoredColumns,
      summary: {
        total: batch.totalRows,
        clean: batch.cleanCount,
        warnings: batch.warningCount,
        errors: batch.errorCount,
      },
      preview: {
        clean: batch.rows.filter((r) => r.bucket === 'CLEAN').map(toPreviewRow),
        warnings: batch.rows.filter((r) => r.bucket === 'WARNING').map(toPreviewRow),
        errors: batch.rows.filter((r) => r.bucket === 'ERROR').map(toPreviewRow),
      },
    }, 'File validated');
  } catch (err) {
    next(err);
  }
}

async function confirmImport(req, res, next) {
  try {
    const importer = requireImporter(req);
    requireRole(importer, req);

    const { batchId, includeRowIds = [] } = req.body;
    if (!batchId) throw ApiError.badRequest('batchId is required');

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, organizationId: req.user.organizationId, entityType: importer.entityType },
      include: { rows: true },
    });
    if (!batch) throw ApiError.notFound('Import batch not found');
    if (batch.status !== 'PENDING') {
      throw ApiError.conflict('This import has already been processed and cannot be run again.');
    }

    const includeSet = new Set(includeRowIds);
    const rowsToImport = batch.rows.filter(
      (r) => r.bucket === 'CLEAN' || (r.bucket === 'WARNING' && includeSet.has(r.id))
    );

    // Record the user's include/exclude choice on each warning row up front,
    // independent of whether the commit below succeeds — the error report
    // needs this to correctly attribute a failed row's reason.
    const includedWarningIds = batch.rows
      .filter((r) => r.bucket === 'WARNING' && includeSet.has(r.id))
      .map((r) => r.id);
    if (includedWarningIds.length > 0) {
      await prisma.importBatchRow.updateMany({
        where: { id: { in: includedWarningIds } },
        data: { included: true },
      });
    }

    if (rowsToImport.length === 0) {
      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: 'COMMITTED', committedAt: new Date(), importedCount: 0 },
      });
      return ApiResponse.success(res, { importedCount: 0, skippedCount: batch.totalRows }, 'No rows were eligible to import.');
    }

    let culpritRowNumber = null;
    try {
      const importedIds = [];
      const commitResults = [];
      await prisma.$transaction(async (tx) => {
        for (const row of rowsToImport) {
          culpritRowNumber = row.rowNumber;
          const { normalized } = parseRowData(row);
          commitResults.push(await importer.commitRow(tx, req.user.organizationId, req.user.id, normalized));
          importedIds.push(row.id);
        }
        await tx.importBatchRow.updateMany({
          where: { id: { in: importedIds } },
          data: { imported: true },
        });
        await tx.importBatch.update({
          where: { id: batch.id },
          data: { status: 'COMMITTED', committedAt: new Date(), importedCount: importedIds.length },
        });
      }, { timeout: 120000 }); // Prisma's 5s default is too short once a batch has more than a
      // handful of rows, each doing multiple sequential writes (e.g. Tenancies
      // creating a user + tenancy + unit update per row) over real network
      // latency to the DB — this was hit and confirmed during testing.

      // Side effects that shouldn't hold the transaction open (e.g. sending
      // welcome emails for newly-created tenant accounts) run only after
      // the commit is durable, and never block or fail the response.
      if (importer.afterCommit) {
        importer.afterCommit(commitResults).catch((e) => logger.error(`[import:${importer.key}] afterCommit failed:`, e));
      }
    } catch (txErr) {
      const reason = txErr.code === 'P2002'
        ? `Row ${culpritRowNumber} conflicts with data that already exists (it may have been imported by someone else since you previewed this file).`
        : `Row ${culpritRowNumber} failed: ${txErr.message}`;

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { status: 'FAILED', failureReason: reason },
      });

      const reasonWithStop = /[.!?]$/.test(reason) ? reason : `${reason}.`;
      throw ApiError.badRequest(
        `Import failed and was fully rolled back — nothing was saved. ${reasonWithStop} Download the error report, fix that row, and re-upload.`
      );
    }

    return ApiResponse.success(res, {
      importedCount: rowsToImport.length,
      skippedCount: batch.totalRows - rowsToImport.length,
    }, `${rowsToImport.length} row(s) imported successfully`);
  } catch (err) {
    next(err);
  }
}

async function downloadErrorReport(req, res, next) {
  try {
    const importer = requireImporter(req);
    requireRole(importer, req);

    const batch = await prisma.importBatch.findFirst({
      where: { id: req.params.batchId, organizationId: req.user.organizationId, entityType: importer.entityType },
      include: { rows: true },
    });
    if (!batch) throw ApiError.notFound('Import batch not found');

    const failedWholeBatch = batch.status === 'FAILED';
    // A FAILED batch rolled back everything, so every row that would have
    // been written (CLEAN, or WARNING the user chose to include) failed
    // together for the same reason. ERROR rows and excluded WARNING rows
    // were never attempted — they keep their own original reason either way.
    const reportRows = failedWholeBatch
      ? batch.rows
      : batch.rows.filter((r) => !r.imported);

    const headerRow = [...importer.columns.map((c) => c.header), 'Reason'];
    const csvRows = [headerRow];

    for (const row of reportRows) {
      const { raw } = parseRowData(row);
      const wasAttempted = row.bucket === 'CLEAN' || (row.bucket === 'WARNING' && row.included);
      const reason = failedWholeBatch && wasAttempted
        ? batch.failureReason
        : (JSON.parse(row.reasons).join(' ') || 'Not imported.');
      csvRows.push([...importer.columns.map((c) => raw[c.key] ?? ''), reason]);
    }

    const csv = toCsv(csvRows);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="rentflow-${importer.key}-import-errors.csv"`);
    return res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = { downloadTemplate, validateUpload, confirmImport, downloadErrorReport };
