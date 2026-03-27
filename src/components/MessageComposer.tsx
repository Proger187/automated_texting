import { useState, useRef, useCallback } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { useAppStore } from '../store/appStore'
import { render, validate } from '../services/templateEngine'

// ── Component ─────────────────────────────────────────────────────────────────

export default function MessageComposer(): JSX.Element {
  const contacts           = useAppStore((s) => s.contacts)
  const headers            = useAppStore((s) => s.headers)
  const variableFields     = useAppStore((s) => s.variableFields)
  const storeSequence      = useAppStore((s) => s.messageSequence)
  const adapterType        = useAppStore((s) => s.adapterType)
  const storeEmailSubject  = useAppStore((s) => s.emailSubject)
  const setMessageSequence = useAppStore((s) => s.setMessageSequence)
  const setEmailSubject    = useAppStore((s) => s.setEmailSubject)

  // Local edit buffers — initialised from store so navigating back restores text
  const [drafts, setDrafts]           = useState<string[]>(storeSequence.length > 0 ? [...storeSequence] : [''])
  const [subjectDraft, setSubjectDraft] = useState<string>(storeEmailSubject)
  const [confirmed, setConfirmed]     = useState<boolean>(storeSequence.some((s) => s.trim().length > 0))
  const [activeBlock, setActiveBlock] = useState<number>(0)
  const [previewTab, setPreviewTab]   = useState<number>(0)

  // One ref slot per message block (array grows as blocks are added)
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([])

  // ── Derived values ───────────────────────────────────────────────────────────

  const firstContact   = contacts[0] ?? null
  // Aggregate unknown variables across all blocks (deduplicated)
  const allUnknownVars = [...new Set(drafts.flatMap((d) => validate(d, headers)))]
  const safePreviewTab = Math.min(previewTab, drafts.length - 1)
  const previewContent = firstContact ? render(drafts[safePreviewTab] ?? '', firstContact) : null

  // ── Insert variable chip at cursor in the active block ───────────────────────

  const insertChip = useCallback((varName: string): void => {
    const ta    = textareaRefs.current[activeBlock]
    const token = `{{${varName}}}`
    if (ta) {
      const start = ta.selectionStart
      const end   = ta.selectionEnd
      setDrafts((prev) => {
        const copy = [...prev]
        copy[activeBlock] = copy[activeBlock].slice(0, start) + token + copy[activeBlock].slice(end)
        return copy
      })
      setConfirmed(false)
      requestAnimationFrame(() => {
        ta.focus()
        const pos = start + token.length
        ta.setSelectionRange(pos, pos)
      })
    } else {
      setDrafts((prev) => {
        const copy = [...prev]
        copy[activeBlock] = (copy[activeBlock] ?? '') + token
        return copy
      })
      setConfirmed(false)
    }
  }, [activeBlock])

  // ── Block mutation helpers ───────────────────────────────────────────────────

  const updateDraft = (idx: number, value: string): void => {
    setDrafts((prev) => {
      const copy = [...prev]
      copy[idx]  = value
      return copy
    })
    setConfirmed(false)
  }

  const addBlock = (): void => {
    setActiveBlock(drafts.length)
    setPreviewTab(drafts.length)
    setDrafts((prev) => [...prev, ''])
    setConfirmed(false)
  }

  const removeBlock = (idx: number): void => {
    if (drafts.length <= 1) return
    setDrafts((prev) => prev.filter((_, i) => i !== idx))
    setActiveBlock((prev) => (prev >= idx && prev > 0) ? prev - 1 : prev)
    setPreviewTab((prev) => (prev >= idx && prev > 0) ? prev - 1 : prev)
    setConfirmed(false)
  }

  // Allow Tab key to insert a real tab character
  const handleKeyDown = (idx: number, e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = textareaRefs.current[idx]
      if (!ta) return
      const s    = ta.selectionStart
      const next = drafts[idx].slice(0, s) + '\t' + drafts[idx].slice(ta.selectionEnd)
      updateDraft(idx, next)
      requestAnimationFrame(() => ta.setSelectionRange(s + 1, s + 1))
    }
  }

  // ── Save sequence to store ───────────────────────────────────────────────────

  const handleUse = (): void => {
    const nonEmpty = drafts.filter((d) => d.trim().length > 0)
    const seq      = nonEmpty.length > 0 ? nonEmpty : ['']
    setMessageSequence(seq)
    if (adapterType === 'email') setEmailSubject(subjectDraft)
    setConfirmed(true)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-6 p-6">

      {/* ── Email subject field ── */}
      {adapterType === 'email' && (
        <div>
          <label
            htmlFor="email-subject"
            className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
          >
            Subject <span className="text-red-400">*</span>
          </label>
          <input
            id="email-subject"
            type="text"
            value={subjectDraft}
            onChange={(e) => { setSubjectDraft(e.target.value); setConfirmed(false) }}
            placeholder="Your email subject line…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
      )}

      {/* ── Variable chips ── */}
      {variableFields.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Insert variable
            {drafts.length > 1 && (
              <span className="ml-2 font-normal normal-case text-gray-400">
                (inserts into Message {activeBlock + 1})
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {variableFields.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertChip(v)}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-violet-100 hover:bg-violet-200 text-violet-800 text-xs font-semibold transition-colors"
                title={`Insert {{${v}}}`}
              >
                <span className="opacity-60">{'{{'}</span>
                {v}
                <span className="opacity-60">{'}}'}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {variableFields.length === 0 && contacts.length === 0 && (
        <p className="text-sm text-gray-400 italic">
          Import an Excel file in Step 1 to see variable chips here.
        </p>
      )}

      {/* ── Unknown-variable warning (aggregated across all blocks) ── */}
      {allUnknownVars.length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <span className="mt-0.5 flex-shrink-0">⚠️</span>
          <span>
            Unknown variable{allUnknownVars.length > 1 ? 's' : ''}:{' '}
            {allUnknownVars.map((v) => (
              <code
                key={v}
                className="mx-0.5 px-1 py-0.5 bg-amber-100 rounded font-mono text-xs text-amber-900"
              >
                {`{{${v}}}`}
              </code>
            ))}
            — these will appear as{' '}
            <code className="px-1 py-0.5 bg-amber-100 rounded font-mono text-xs text-amber-900">
              [variableName]
            </code>{' '}
            in the sent message.
          </span>
        </div>
      )}

      {/* ── Message blocks ── */}
      <div className="flex flex-col gap-4">
        {drafts.map((draft, idx) => (
          <div
            key={idx}
            className={[
              'border rounded-xl p-4 transition-colors',
              activeBlock === idx ? 'border-violet-400 bg-violet-50/30' : 'border-gray-200 bg-white',
            ].join(' ')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Message {idx + 1}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 tabular-nums">
                  {draft.length} char{draft.length !== 1 ? 's' : ''}
                </span>
                {drafts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(idx)}
                    className="text-gray-400 hover:text-red-500 text-sm leading-none transition-colors"
                    title="Remove this message"
                    aria-label={`Remove message ${idx + 1}`}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            <textarea
              ref={(el) => { textareaRefs.current[idx] = el }}
              value={draft}
              onFocus={() => setActiveBlock(idx)}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => updateDraft(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              rows={8}
              placeholder={
                idx === 0
                  ? 'Hello {{Name}},\n\nYour order {{OrderId}} is ready for pickup.\n\nThank you!'
                  : 'Follow-up message…'
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-y leading-relaxed"
              spellCheck={false}
            />
          </div>
        ))}
      </div>

      {/* ── Add message button ── */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addBlock}
          className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-violet-400 hover:border-violet-600 text-violet-600 hover:text-violet-700 text-sm font-semibold rounded-lg transition-colors"
        >
          ＋ Add message
        </button>
        {drafts.length > 1 && (
          <span className="text-xs text-gray-400">
            {drafts.length} messages — each contact will receive all of them in order.
          </span>
        )}
      </div>

      {/* ── Per-block preview (tabbed) ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1 border-b border-gray-200">
          {drafts.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPreviewTab(idx)}
              className={[
                'px-3 py-1.5 text-xs font-semibold border-b-2 -mb-px transition-colors',
                safePreviewTab === idx
                  ? 'border-violet-500 text-violet-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              Preview {idx + 1}
            </button>
          ))}
          {firstContact && (
            <span className="ml-2 text-xs font-normal text-gray-400 pb-1">
              (rendered against row 1)
            </span>
          )}
        </div>
        <div className="w-full min-h-[10rem] border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-sm font-mono whitespace-pre-wrap leading-relaxed text-gray-800 overflow-auto">
          {(drafts[safePreviewTab] ?? '').length === 0 ? (
            <span className="text-gray-300 italic">Start typing to see a preview…</span>
          ) : firstContact === null ? (
            <span className="text-gray-400 italic">(no contacts imported)</span>
          ) : (
            previewContent
          )}
        </div>
      </div>

      {/* ── "Use this sequence" button ── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleUse}
          disabled={drafts.every((d) => d.trim().length === 0)}
          className="px-6 py-2 bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Use this sequence
        </button>

        {confirmed && (
          <span className="text-green-600 text-sm font-medium flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 rounded-full text-xs font-bold text-green-600">
              ✓
            </span>
            Sequence saved to store
          </span>
        )}
      </div>
    </div>
  )
}
