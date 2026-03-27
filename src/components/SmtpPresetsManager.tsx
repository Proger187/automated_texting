import { useState, useEffect, useCallback } from 'react'
import type { SmtpPreset } from '../types/smtpPresets'

interface Props {
  onClose: () => void
}

export default function SmtpPresetsManager({ onClose }: Props): JSX.Element {
  const [presets, setPresets] = useState<SmtpPreset[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [form, setForm] = useState({ name: '', host: '', port: '587', secure: false })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadPresets = useCallback(async () => {
    if (!window.electronAPI) return
    const list = await window.electronAPI.listSmtpPresets()
    setPresets(list)
  }, [])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  async function handleAdd(): Promise<void> {
    if (!form.name.trim()) { setFormError('Name is required.'); return }
    if (!form.host.trim()) { setFormError('Host is required.'); return }
    const port = parseInt(form.port, 10)
    if (!port || port < 1 || port > 65535) { setFormError('Port must be 1–65535.'); return }
    if (!window.electronAPI) return
    setSaving(true)
    setFormError(null)
    try {
      await window.electronAPI.saveSmtpPreset({
        id: crypto.randomUUID(),
        name: form.name.trim(),
        host: form.host.trim(),
        port,
        secure: form.secure,
        isBuiltIn: false,
      })
      setForm({ name: '', host: '', port: '587', secure: false })
      setShowAddForm(false)
      void loadPresets()
    } catch (e) {
      setFormError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!window.electronAPI) return
    if (!confirm('Delete this SMTP server preset?')) return
    await window.electronAPI.deleteSmtpPreset(id)
    void loadPresets()
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500'

  return (
    <div className="border border-gray-200 rounded-xl bg-gray-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-700">SMTP Server Presets</h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          aria-label="Close presets manager"
        >
          ×
        </button>
      </div>

      {/* Preset list */}
      <div className="space-y-2">
        {presets.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No presets yet.</p>
        )}
        {presets.map((p) => (
          <div key={p.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
            <div>
              <span className="text-sm font-semibold text-gray-800">{p.name}</span>
              {p.isBuiltIn && (
                <span className="ml-2 text-xs bg-blue-100 text-blue-600 font-semibold px-1.5 py-0.5 rounded">built-in</span>
              )}
              <div className="text-xs text-gray-500 mt-0.5">
                {p.host}:{p.port} — {p.secure ? 'TLS' : 'STARTTLS'}
              </div>
            </div>
            {!p.isBuiltIn && (
              <button
                onClick={() => void handleDelete(p.id)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold ml-3 shrink-0"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAddForm ? (
        <div className="border border-violet-200 rounded-lg bg-white p-3 space-y-2">
          <p className="text-xs font-bold text-gray-700 mb-1">New SMTP server</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Name <span className="text-red-500">*</span></label>
              <input type="text" className={inp} placeholder="e.g. Gmail"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Host <span className="text-red-500">*</span></label>
              <input type="text" className={inp} placeholder="smtp.gmail.com"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-0.5">Port</label>
              <input type="number" className={inp} placeholder="587"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-700">
                <input type="checkbox" className="rounded"
                  checked={form.secure}
                  onChange={(e) => setForm((f) => ({ ...f, secure: e.target.checked }))} />
                Implicit TLS (port 465)
              </label>
            </div>
          </div>
          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{formError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void handleAdd()}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white text-xs font-semibold transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormError(null) }}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-1.5 rounded-lg border border-dashed border-violet-300 text-violet-600 text-xs font-semibold hover:bg-violet-50 transition-colors"
        >
          ＋ Add server
        </button>
      )}
    </div>
  )
}
