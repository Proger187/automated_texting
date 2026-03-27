// ── Template token regex ───────────────────────────────────────────────────────
const TOKEN_RE = /\{\{([^}]+)\}\}/g

/**
 * Replace all {{variableName}} tokens with contact[variableName].
 * Variables not found in contact render as [variableName] (visible placeholder).
 */
export function render(
  template: string,
  contact: Record<string, string>,
): string {
  return template.replace(TOKEN_RE, (_match, name: string) => {
    const trimmed = name.trim()
    return trimmed in contact ? contact[trimmed] : `[${trimmed}]`
  })
}

/**
 * Return all unique variable names found in the template.
 */
export function extractVariables(template: string): string[] {
  const found: string[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(TOKEN_RE.source, 'g')
  while ((match = re.exec(template)) !== null) {
    const name = match[1].trim()
    if (!found.includes(name)) found.push(name)
  }
  return found
}

/**
 * Return variable names that appear in the template but are absent from headers.
 */
export function validate(template: string, headers: string[]): string[] {
  return extractVariables(template).filter((v) => !headers.includes(v))
}
