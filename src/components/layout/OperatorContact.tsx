import { contactHref } from '@/server/instance'

// Renders the tail of a sentence: "...help, <OperatorContact />."
export function OperatorContact({ contact }: { contact: string | null }) {
  if (!contact) return <>ask them directly</>
  const href = contactHref(contact)
  return <>reach them at {href ? <a className="underline" href={href}>{contact}</a> : <strong>{contact}</strong>}</>
}
