import { useState, useCallback, useRef } from 'react'
import type { DragEvent, ChangeEvent } from 'react'
import { parseFile } from '../services/excelParser'
import type { ParseResult } from '../services/excelParser'
import { useAppStore } from '../store/appStore'

// ── Types ──────────────────────────────────────────────────────────────────────

interface LocalState {
  result: ParseResult | null
  filename: string
  contactField: string
  variableFields: string[]
  error: string | null
  isDragOver: boolean
  isLoading: boolean
  isConfirmed: boolean
}

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']

function isAccepted(file: File): boolean {
  const lower = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ExcelImporter(): JSX.Element {
  const setImportData = useAppStore((s) => s.setImportData)

  // Initialise from store so navigating back restores previous import
  const storeContacts = useAppStore((s) => s.contacts)
  const storeHeaders = useAppStore((s) => s.headers)
  const storeContactField = useAppStore((s) => s.contactField)
  const storeVariableFields = useAppStore((s) => s.variableFields)
  const storeFilename = useAppStore((s) => s.filename)

  const [s, setS] = useState<LocalState>(() => ({
    result:
      storeContacts.length > 0
        ? { headers: storeHeaders, rows: storeContacts }
        : null,
    filename: storeFilename,
    contactField: storeContactField,
    variableFields: storeVariableFields,
    error: null,
    isDragOver: false,
    isLoading: false,
    isConfirmed: storeContacts.length > 0,
  }))

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── File processing ──────────────────────────────────────────────────────────

  const processFile = useCallback(async (file: File) => {
    if (!isAccepted(file)) {
      setS((prev) => ({
        ...prev,
        error: 'Unsupported file type. Please use .xlsx, .xls, or .csv',
      }))
      return
    }

    setS((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      isConfirmed: false,
    }))

    try {
      const result = await parseFile(file)
      const firstHeader = result.headers[0] ?? ''
      setS((prev) => ({
        ...prev,
        result,
        filename: file.name,
        contactField: firstHeader,
        variableFields: result.headers.length > 1 ? result.headers.slice(1) : [],
        isLoading: false,
      }))
    } catch (err) {
      setS((prev) => ({
        ...prev,
        error: `Failed to parse file: ${err instanceof Error ? err.message : 'Unknown error'}`,
        isLoading: false,
      }))
    }
  }, [])

  // ── Drag-and-drop handlers ───────────────────────────────────────────────────

  const onDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setS((prev) => ({ ...prev, isDragOver: true }))
  }

  const onDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setS((prev) => ({ ...prev, isDragOver: false }))
  }

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      setS((prev) => ({ ...prev, isDragOver: false }))
      const file = e.dataTransfer.files[0]
      if (file) void processFile(file)
    },
    [processFile],
  )

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (file) void processFile(file)
    e.target.value = '' // allow re-selecting the same file
  }

  // ── Column helpers ───────────────────────────────────────────────────────────

  const toggleVariableField = (header: string): void => {
    setS((prev) => ({
      ...prev,
      variableFields: prev.variableFields.includes(header)
        ? prev.variableFields.filter((h) => h !== header)
        : [...prev.variableFields, header],
    }))
  }

  // ── Confirm import ───────────────────────────────────────────────────────────

  const confirmImport = (): void => {
    if (!s.result || !s.contactField) return
    setImportData({
      contacts: s.result.rows,
      headers: s.result.headers,
      contactField: s.contactField,
      variableFields: s.variableFields,
      filename: s.filename,
    })
    setS((prev) => ({ ...prev, isConfirmed: true }))
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const previewRows = s.result?.rows.slice(0, 5) ?? []
  const headers = s.result?.headers ?? []

  return (
    <div className="max-w-5xl mx-auto">

      {/* ── Drop zone ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Excel file"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all select-none',
          s.isDragOver
            ? 'border-violet-500 bg-violet-50 scale-[1.01]'
            : 'border-gray-300 bg-gray-50 hover:border-violet-400 hover:bg-violet-50/50',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={onFileInputChange}
        />

        <div className="text-4xl mb-3 pointer-events-none">📂</div>

        {s.isLoading ? (
          <p className="text-violet-600 font-medium animate-pulse">Parsing file…</p>
        ) : s.filename ? (
          <div className="pointer-events-none">
            <p className="text-gray-800 font-semibold text-lg">{s.filename}</p>
            <p className="text-gray-400 text-sm mt-1">
              {s.result?.rows.length ?? 0} rows · click or drop to replace
            </p>
          </div>
        ) : (
          <div className="pointer-events-none">
            <p className="text-gray-600 font-medium text-lg">
              Drag &amp; drop your spreadsheet here
            </p>
            <p className="text-gray-400 text-sm mt-1">
              or click to browse &nbsp;·&nbsp; .xlsx &nbsp;.xls &nbsp;.csv
            </p>
          </div>
        )}
      </div>

      {/* ── Error banner ── */}
      {s.error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          ⚠️ {s.error}
        </div>
      )}

      {/* ── Preview + mapping (shown after a file is loaded) ── */}
      {s.result && headers.length > 0 && (
        <>
          {/* Preview table */}
          <div className="mt-6">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Preview — first {previewRows.length} row{previewRows.length !== 1 ? 's' : ''}
            </h3>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="px-4 py-2 text-gray-700 truncate max-w-[180px]"
                          title={row[h]}
                        >
                          {row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column mapping */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Contact field dropdown */}
            <div>
              <label
                htmlFor="contact-field-select"
                className="block text-sm font-semibold text-gray-700 mb-1"
              >
                Contact field
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  (phone / email / Telegram ID)
                </span>
              </label>
              <select
                id="contact-field-select"
                value={s.contactField}
                onChange={(e) =>
                  setS((prev) => ({ ...prev, contactField: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Variable columns checkboxes */}
            <div>
              <p className="block text-sm font-semibold text-gray-700 mb-1">
                Variable columns
                <span className="text-gray-400 font-normal ml-1 text-xs">
                  (used in message template)
                </span>
              </p>
              <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5 bg-white">
                {headers.map((h) => (
                  <label
                    key={h}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={s.variableFields.includes(h)}
                      onChange={() => toggleVariableField(h)}
                      className="accent-violet-600 w-4 h-4 flex-shrink-0"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-violet-700 truncate">
                      {h}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Confirm import */}
          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={confirmImport}
              disabled={!s.contactField}
              className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Confirm import
            </button>

            {s.isConfirmed && (
              <span className="text-green-600 text-sm font-medium flex items-center gap-1.5">
                <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 rounded-full text-green-600 text-xs font-bold">
                  ✓
                </span>
                {s.result.rows.length} contact{s.result.rows.length !== 1 ? 's' : ''} imported
                from <span className="font-semibold">{s.filename}</span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
