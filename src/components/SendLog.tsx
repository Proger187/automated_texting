import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import type { LogEntry } from '../services/logger'
import { downloadCSV } from '../services/logger'

type SortOrder = 'failed-first' | 'success-first'

interface Props {
  // reads entirely from Zustand store; no required props
}

export default function SendLog(_props: Props): JSX.Element {
  const sendState    = useAppStore((s) => s.sendState)
  const contacts     = useAppStore((s) => s.contacts)
  const contactField = useAppStore((s) => s.contactField)
  const headers      = useAppStore((s) => s.headers)
  const variableFields = useAppStore((s) => s.variableFields)
  const filename     = useAppStore((s) => s.filename)
  const setImportData = useAppStore((s) => s.setImportData)
  const setSendState  = useAppStore((s) => s.setSendState)
  const resetStore    = useAppStore((s) => s.resetStore)

  const [sortOrder, setSortOrder] = useState<SortOrder>('failed-first')

  const { results, total, successCount, failCount } = sendState

  // Convert store results to LogEntry (normalise optional fields)
  const logEntries: LogEntry[] = results.map((r) => ({
    contact: r.contact,
    renderedMessage: r.renderedMessage ?? '',
    success: r.success,
    error: r.error,
    timestamp: r.timestamp ?? '',
  }))

  const sorted = [...logEntries].sort((a, b) => {
    if (sortOrder === 'failed-first') {
      // failures (0) before successes (1)
      return (a.success ? 1 : 0) - (b.success ? 1 : 0)
    }
    // successes (1) before failures (0)
    return (b.success ? 1 : 0) - (a.success ? 1 : 0)
  })

  function toggleSort(): void {
    setSortOrder((prev) =>
      prev === 'failed-first' ? 'success-first' : 'failed-first'
    )
  }

  function handleExportCSV(): void {
    downloadCSV(logEntries, 'bulkmessenger-results.csv')
  }

  function handleRetryFailed(): void {
    const failedContactValues = results
      .filter((r) => !r.success)
      .map((r) => r.contact)

    const failedRows = contacts.filter((row) =>
      failedContactValues.includes(row[contactField] ?? '')
    )

    setImportData({
      contacts: failedRows,
      headers,
      contactField,
      variableFields,
      filename,
    })

    setSendState({
      status: 'idle',
      index: 0,
      total: failedRows.length,
      results: [],
      successCount: 0,
      failCount: 0,
    })
  }

  function handleStartOver(): void {
    resetStore()
  }

  const sortLabel =
    sortOrder === 'failed-first' ? '↑ Failed first' : '↓ Success first'

  return (
    <div className="p-6 space-y-6">
      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="flex gap-4">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-gray-700">{total}</div>
          <div className="text-xs text-gray-500 font-medium mt-1">Total</div>
        </div>
        <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-green-700">{successCount}</div>
          <div className="text-xs text-green-600 font-medium mt-1">Sent</div>
        </div>
        <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center shadow-sm">
          <div className="text-3xl font-bold text-red-700">{failCount}</div>
          <div className="text-xs text-red-600 font-medium mt-1">Failed</div>
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
        >
          ⬇ Export CSV
        </button>
        {failCount > 0 && (
          <button
            onClick={handleRetryFailed}
            className="inline-flex items-center gap-2 bg-amber-100 hover:bg-amber-200 text-amber-800 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
          >
            🔁 Retry failed ({failCount})
          </button>
        )}
        <button
          onClick={handleStartOver}
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg transition-colors text-sm"
        >
          ↩ Start over
        </button>
      </div>

      {/* ── Results table ─────────────────────────────────────────────────── */}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-1/4">
                Contact
              </th>
              {/* Sortable status column */}
              <th
                className="text-left px-4 py-3 font-semibold text-gray-600 w-20 cursor-pointer select-none hover:text-violet-700"
                onClick={toggleSort}
                title="Click to toggle sort order"
              >
                Status{' '}
                <span className="text-xs font-normal text-gray-400">{sortLabel}</span>
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">
                Error
              </th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 w-48">
                Timestamp
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="text-center text-gray-400 py-8 italic"
                >
                  No results recorded.
                </td>
              </tr>
            )}
            {sorted.map((entry, i) => (
              <tr
                key={i}
                className={
                  entry.success
                    ? 'hover:bg-green-50/40'
                    : 'hover:bg-red-50/40'
                }
              >
                <td className="px-4 py-2.5 text-gray-800 break-all">
                  {entry.contact || '—'}
                </td>
                <td className="px-4 py-2.5">
                  {entry.success ? (
                    <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                      ✅ Sent
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      ❌ Failed
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-red-500 text-xs break-words max-w-xs">
                  {entry.error ?? '—'}
                </td>
                <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                  {entry.timestamp
                    ? new Date(entry.timestamp).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
