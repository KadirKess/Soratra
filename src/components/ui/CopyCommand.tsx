'use client'

import { useRef, useState } from 'react'
import { copyText } from './copyText'

// Shell commands as one block, copied together so they can be pasted in one go.
export function CopyCommand({ lines, label }: { lines: string[]; label: string }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  const text = lines.join('\n')

  async function copy() {
    const ok = await copyText(text, () => {
      if (preRef.current) window.getSelection()?.selectAllChildren(preRef.current)
    })
    if (!ok) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <div className="link-box">
      {/* auth-input sets font-family: inherit, so the monospace stack goes inline, as in .link-box input. */}
      <pre ref={preRef} aria-label={label} className="auth-input flex-1 min-w-0 overflow-x-auto text-xs leading-6 m-0" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{text}</pre>
      <button type="button" onClick={copy} className="btn-secondary px-3 whitespace-nowrap self-start">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
