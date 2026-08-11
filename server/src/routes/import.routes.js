const { Router } = require('express');
const controller = require('../controllers/import.controller');
const { authenticate } = require('../middleware/auth');
const { uploadCsv } = require('../middleware/csvUpload');

const router = Router();

router.get('/:entityType/template', authenticate, controller.downloadTemplate);
router.post('/:entityType/validate', authenticate, uploadCsv, controller.validateUpload);
router.post('/:entityType/confirm', authenticate, controller.confirmImport);
router.get('/:entityType/:batchId/errors', authenticate, controller.downloadErrorReport);

module.exports = router;
