export interface SmtpPreset {
  id: string          // uuid or well-known slug for built-ins e.g. 'moosend'
  name: string        // display label e.g. "Moosend", "Gmail", "Custom"
  host: string        // SMTP host e.g. smtp.moosend.com
  port: number        // e.g. 587
  secure: boolean     // true = implicit TLS (port 465); false = STARTTLS (port 587)
  isBuiltIn: boolean  // built-in presets cannot be deleted
}
