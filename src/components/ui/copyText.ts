// The clipboard API needs HTTPS or localhost; plain http on a LAN address only
// has the older selection-based copy, which needs the text selected on screen.
export async function copyText(text: string, selectFallback: () => void) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    selectFallback()
    return document.execCommand('copy')
  }
}
