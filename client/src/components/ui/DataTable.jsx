import { FileX, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  )
}

export default function DataTable({
  columns,
  data = [],
  loading = false,
  emptyMessage = 'No data found',
  onRowClick,
  sortKey,
  sortDir = 'asc',
  onSortChange,
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm bg-white">
      <table className="min-w-full divide-y divide-gray-100">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => {
              const sortable = col.sortable && onSortChange
              const isActive = sortKey === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSortChange(col.key)}
                      className="flex items-center gap-1 hover:text-gray-700"
                    >
                      {col.label}
                      {isActive ? (
                        sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={columns.length} />
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <FileX className="h-8 w-8" />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
