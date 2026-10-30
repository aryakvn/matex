// A .matex file is a plain zip: DOCUMENT.md at the root plus assets/<name> files.
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'

const DOC = 'DOCUMENT.md'

export function pack({ markdown, files }) {
  return zipSync({ [DOC]: strToU8(markdown), ...files })
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
  return { markdown: strFromU8(entries[DOC]), files }
}
