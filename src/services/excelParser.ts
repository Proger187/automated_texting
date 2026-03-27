import * as XLSX from 'xlsx'

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
}

/**
 * Parse an Excel / CSV file into a typed ParseResult.
 *
 * @param source - A browser File object (drag-and-drop) or an absolute file-path
 *                 string (Node.js / Electron main process).
 */
export async function parseFile(source: File | string): Promise<ParseResult> {
  let workbook: XLSX.WorkBook

  if (typeof source === 'string') {
    // Node.js path — synchronous read (only valid in Node context)
    workbook = XLSX.readFile(source)
  } else {
    // Browser File object — read as ArrayBuffer
    const arrayBuffer = await source.arrayBuffer()
    workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  }

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return { headers: [], rows: [] }

  const sheet = workbook.Sheets[sheetName]

  // sheet_to_json with defval ensures empty cells become '' not undefined
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false, // format dates/numbers as strings
  })

  if (raw.length === 0) return { headers: [], rows: [] }

  const headers: string[] = Object.keys(raw[0])
  const rows: Record<string, string>[] = raw.map((row) =>
    Object.fromEntries(headers.map((h) => [h, String(row[h] ?? '')]))
  )

  return { headers, rows }
}
