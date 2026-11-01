// A .matex file is a plain zip: DOCUMENT.md at the root plus assets/<name> files, page.json (layout)
// style.css (the document's own CSS, layout.css in memory) and script.js (layout.script, the
// header/footer scripts' shared code), plus fonts/<file> (fonts carried with the document, fonts.js).
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { normalizeLayout, isDefaultLayout } from './layout.js'

const DOC = 'DOCUMENT.md'
const LAYOUT = 'page.json' // header/footer/page numbers; absent = defaults
const STYLE = 'style.css' // absent = none
const SCRIPT = 'script.js' // absent = none

export function pack({ markdown, files, layout, fonts = {} }) {
  const { css = '', script = '', ...rest } = layout ?? {}
  const extra = {}
  if (layout && !isDefaultLayout({ ...rest, css: '', script: '' })) extra[LAYOUT] = strToU8(JSON.stringify(rest))
  if (css.trim()) extra[STYLE] = strToU8(css)
  if (script.trim()) extra[SCRIPT] = strToU8(script)
  return zipSync({ [DOC]: strToU8(markdown), ...extra, ...files, ...fonts })
}

export function unpack(bytes) {
  let entries
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new Error('Not a MaTex document: the file is not a valid archive.')
  }
  if (!(DOC in entries)) throw new Error(`Not a MaTex document: ${DOC} is missing.`)
  const files = {}
  const fonts = {}
  for (const [path, data] of Object.entries(entries)) {
    if (path.endsWith('/')) continue
    if (path.startsWith('assets/')) files[path] = data
    else if (path.startsWith('fonts/')) fonts[path] = data
  }
  let layout = null
  try {
    if (LAYOUT in entries) layout = normalizeLayout(JSON.parse(strFromU8(entries[LAYOUT])))
  } catch {} // a damaged page.json costs the layout, not the document
  if (STYLE in entries) layout = { ...(layout ?? normalizeLayout(null)), css: strFromU8(entries[STYLE]) }
  if (SCRIPT in entries) layout = { ...(layout ?? normalizeLayout(null)), script: strFromU8(entries[SCRIPT]) }
  return { markdown: strFromU8(entries[DOC]), files, fonts, layout }
}
