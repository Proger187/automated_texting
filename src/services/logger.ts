export type LogEntry = {
  contact: string
  renderedMessage: string
  success: boolean
  error?: string
  timestamp: string
}

function escapeField(value: string): string {
  const v = String(value)
  if (/[,"\n\r]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`
  }
  return v
}

export function exportCSV(results: LogEntry[]): string {
  const header = 'Contact,Message,Status,Error,Timestamp'
  const rows = results.map((e) =>
    [
      escapeField(e.contact),
      escapeField(e.renderedMessage),
      e.success ? 'Sent' : 'Failed',
      escapeField(e.error ?? ''),
      escapeField(e.timestamp),
    ].join(',')
  )
  return [header, ...rows].join('\r\n')
}

export function downloadCSV(results: LogEntry[], filename: string): void {
  const csv = exportCSV(results)
  // BOM prefix ensures Excel opens UTF-8 CSV correctly
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
