const multer = require('multer');
const ApiError = require('../utils/ApiError');

// Bulk-import uploads are parsed in memory and discarded once validated/
// committed — unlike uploadSingle/uploadMultiple in upload.js, nothing here
// is meant to persist to disk the way a lease document or receipt photo does.
const ALLOWED_MIMETYPES = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'];
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous for a 5,000-row CSV

const fileFilter = (req, file, cb) => {
  const hasCsvExtension = /\.csv$/i.test(file.originalname || '');
  if (ALLOWED_MIMETYPES.includes(file.mimetype) || hasCsvExtension) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only CSV files are supported. Please upload a .csv file.'), false);
  }
};

const uploadCsv = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
}).single('file');

module.exports = { uploadCsv, MAX_FILE_BYTES };
