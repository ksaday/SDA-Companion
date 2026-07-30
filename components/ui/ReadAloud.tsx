'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Read Aloud uses the browser's own speech synthesis, so it needs no API key
 * and no audio egress. Swap for Cloud TTS when server-side voices are wanted
 * (see planning doc §20) — the component contract stays the same.
 */
export function ReadAloud({
  text,
  label = 'Read aloud',
  lang = 'en-US',
}: {
  text: string
  label?: string
  lang?: string
}) {
  const [supported, setSupported] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  if (!supported) return null

  function toggle() {
    const synth = window.speechSynthesis
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }

    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.92
    utterance.pitch = 1
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    utteranceRef.current = utterance
    synth.speak(utterance)
    setSpeaking(true)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-quiet)]"
      style={{ borderColor: 'var(--rule)', color: 'var(--text-soft)' }}
      aria-label={speaking ? 'Stop reading' : label}
    >
      <span aria-hidden>{speaking ? '◼' : '▶'}</span>
      {speaking ? 'Stop' : label}
    </button>
  )
}
