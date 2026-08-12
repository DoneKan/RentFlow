import { useNavigate } from 'react-router-dom'
import { Upload, ChevronRight, Clock } from 'lucide-react'
import { IMPORT_ENTITIES, IMPORT_ENTITY_ORDER } from '../../config/importEntities'
import PageHeader from '../../components/ui/PageHeader'

export default function ImportHubPage() {
  const navigate = useNavigate()

  return (
    <div>
      <PageHeader
        title="Data Import"
        subtitle="Bulk-import data from a CSV file — nothing is saved until you review and confirm"
      />

      <div className="max-w-2xl space-y-3">
        {IMPORT_ENTITY_ORDER.map((key) => {
          const entity = IMPORT_ENTITIES[key]
          return (
            <button
              key={key}
              onClick={() => entity.available && navigate(`/import/${key}`)}
              disabled={!entity.available}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-colors ${
                entity.available
                  ? 'bg-white border-gray-100 shadow-sm hover:border-brand/30 hover:shadow-md cursor-pointer'
                  : 'bg-gray-50 border-gray-100 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 flex-shrink-0">
                <Upload className="h-5 w-5 text-brand" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{entity.label}</p>
                <p className="text-sm text-gray-500">{entity.description}</p>
              </div>
              {entity.available ? (
                <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
              ) : (
                <span className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  Coming soon
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
