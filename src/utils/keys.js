// Ctrl/Cmd+N, O, S, Shift+S → file action name, or null.
// Uses the physical key (e.code) so it also works on the Persian layout, where e.key is 'س'.
export function fileAction(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  const key = e.code?.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase()
  if (key === 's') return e.shiftKey ? 'saveAs' : 'save'
  if (e.shiftKey) return null
  return { n: 'new', o: 'open' }[key] ?? null
}
