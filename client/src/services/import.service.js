import api from './api'

export const downloadImportTemplate = (entityType) =>
  api.get(`/imports/${entityType}/template`, { responseType: 'blob' }).then((r) => r.data)

export const validateImportFile = (entityType, file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post(`/imports/${entityType}/validate`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data)
}

export const confirmImport = (entityType, batchId, includeRowIds = []) =>
  api.post(`/imports/${entityType}/confirm`, { batchId, includeRowIds }).then((r) => r.data)

export const downloadImportErrorReport = (entityType, batchId) =>
  api.get(`/imports/${entityType}/${batchId}/errors`, { responseType: 'blob' }).then((r) => r.data)
