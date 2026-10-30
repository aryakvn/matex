// A .matex file is a plain zip: DOCUMENT.md at the root plus assets/<name> files.
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { normalizeLayout, isDefaultLayout } from './layout.js'

const DOC = 'DOCUMENT.md'
const LAYOUT = 'page.json' // header/footer/page numbers; absent = defaults

export function pack({ markdown, files, layout }) {
  const extra = layout && !isDefaultLayout(layout) ? { [LAYOUT]: strToU8(JSON.stringify(layout)) } : {}
  return zipSync({ [DOC]: strToU8(markdown), ...extra, ...files })
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
  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith('assets/') && !path.endsWith('/')) files[path] = data
  }
  let layout = null
  try {
    if (LAYOUT in entries) layout = normalizeLayout(JSON.parse(strFromU8(entries[LAYOUT])))
  } catch {} // a damaged page.json costs the layout, not the document
  return { markdown: strFromU8(entries[DOC]), files, layout }
}
