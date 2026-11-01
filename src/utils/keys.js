// Ctrl/Cmd+N, O, S, Shift+S, P → file action name, or null.
// Uses the physical key (e.code) so it also works on the Persian layout, where e.key is 'س'.
export function fileAction(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  const key = e.code?.startsWith('Key') ? e.code.slice(3).toLowerCase() : e.key.toLowerCase()
  if (key === 's') return e.shiftKey ? 'saveAs' : 'save'
  if (e.shiftKey) return null
  return { n: 'new', o: 'open', p: 'print' }[key] ?? null
}

// Ctrl/Cmd + = / - / 0 (main row or numpad) → zoom step 1 / -1, or 0 = back to 100%; else null.
export function zoomKey(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return null
  return { Equal: 1, NumpadAdd: 1, Minus: -1, NumpadSubtract: -1, Digit0: 0, Numpad0: 0 }[e.code] ?? null
}
