'use client'

import { useEffect, useRef, useState } from 'react'

// Shows a one-time link built from the address the admin is using right now,
// so it works whether Soratra is reached on localhost, the LAN or a domain.
export function CopyLink({ path, label }: { path: string; label: string }) {
  const [url, setUrl] = useState(path)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setUrl(new URL(path, window.location.origin).toString())
  }, [path])

  async function copy(input: HTMLInputElement | null) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // The clipboard API needs HTTPS or localhost; plain http on a LAN address
      // only has the older selection-based copy.
      input?.select()
      if (!document.execCommand('copy')) return
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <div className="link-box">
      <label className="sr-only" htmlFor={`link-${path}`}>{label}</label>
      <input ref={inputRef} id={`link-${path}`} readOnly value={url} className="auth-input" onFocus={(event) => event.currentTarget.select()} />
      <button type="button" onClick={() => copy(inputRef.current)} className="btn-secondary px-3 whitespace-nowrap">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
