'use client'

import { useEffect, useRef, useState } from 'react'
import { CitationChips } from '@/components/ui/CitationChips'
import { ReadAloud } from '@/components/ui/ReadAloud'
import type { PrayerResult } from '@/lib/ai/types'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function PrayerEditor({
  prayer,
  situation,
  sessionId,
}: {
  prayer: PrayerResult
  situation: string
  sessionId: string | null
}) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [speakText, setSpeakText] = useState(prayer.plain)

  // Content is written straight into the DOM once. React must not re-render
  // the node afterwards or it would fight the member's caret while they type.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.innerHTML = prayer.html
      setSpeakText(prayer.plain)
    }
  }, [prayer.html, prayer.plain])

  function currentHtml() {
    return bodyRef.current?.innerHTML ?? prayer.html
  }
  function currentText() {
    return bodyRef.current?.innerText ?? prayer.plain
  }

  function format(command: 'bold' | 'italic') {
    bodyRef.current?.focus()
    document.execCommand(command, false)
  }

  async function save() {
    setSaveState('saving')
    try {
      const res = await fetch('/api/prayers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: situation.slice(0, 80) || 'Prayer',
          bodyHtml: currentHtml(),
          bodyPlain: currentText(),
          originalHtml: prayer.html,
          sessionId: sessionId ?? undefined,
        }),
      })
      setSaveState(res.ok ? 'saved' : 'error')
    } catch {
      setSaveState('error')
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(currentText())
      setSaveState('idle')
    } catch {
      // Clipboard permission denied — the text is still selectable by hand.
    }
  }

  function exportTxt() {
    const blob = new Blob([currentText()], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prayer-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const toolbarButton =
    'rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-quiet)]'

  return (
    <div
      className="print-sheet rise rounded-xl border p-5"
      style={{ borderColor: 'var(--rule)', background: 'var(--surface-raised)' }}
    >
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => format('bold')} className={toolbarButton} style={{ borderColor: 'var(--rule)' }}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => format('italic')} className={toolbarButton} style={{ borderColor: 'var(--rule)' }}>
          <em>I</em>
        </button>

        <span className="mx-1 h-4 w-px" style={{ background: 'var(--rule)' }} />

        <ReadAloud text={speakText} label="Read aloud" />
        <button type="button" onClick={copy} className={toolbarButton} style={{ borderColor: 'var(--rule)' }}>
          Copy
        </button>
        <button type="button" onClick={exportTxt} className={toolbarButton} style={{ borderColor: 'var(--rule)' }}>
          Export
        </button>
        <button type="button" onClick={() => window.print()} className={toolbarButton} style={{ borderColor: 'var(--rule)' }}>
          Print
        </button>

        <button
          type="button"
          onClick={save}
          disabled={saveState === 'saving'}
          className="ml-auto rounded-full px-4 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--accent)' }}
        >
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved ✓'
              : saveState === 'error'
                ? 'Retry save'
                : 'Save prayer'}
        </button>
      </div>

      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          setSaveState('idle')
          setSpeakText(currentText())
        }}
        className="prayer-body serif text-lg"
        style={{ color: 'var(--text)' }}
        aria-label="Prayer text, editable"
      />

      <p className="no-print mt-4 text-xs" style={{ color: 'var(--text-soft)' }}>
        This prayer is yours to edit. It was composed{' '}
        {prayer.generator === 'gemini'
          ? 'by the model under closed-context rules'
          : 'by the offline composer'}{' '}
        using only the sources cited below.
      </p>

      <div className="no-print">
        <CitationChips citations={prayer.citations} />
      </div>
    </div>
  )
}
