'use client'

import { useState, type ComponentProps } from 'react'

type Props = Omit<ComponentProps<'input'>, 'type'>

export function PasswordInput({ className, ...props }: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={`${className ?? ''} pr-16`} />
      <button
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 px-3 text-sm font-medium"
        style={{ color: 'var(--muted)' }}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
