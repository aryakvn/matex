// Images live in memory as blob URLs while editing (so the editor can show them)
// and become assets/<name> references when the document is saved.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Swap `from` for `to` only where it is a link/image target:
// after "](" or src=" / src=' (optionally "./"), and before ")", whitespace or a quote.
function replaceTargets(text, from, to) {
  const re = new RegExp(`(\\]\\(|src=["'])(?:\\./)?${escape(from)}(?=[)\\s"'])`, 'g')
  return text.replace(re, (_, lead) => lead + to)
}

function safeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'image'
}

export function createAssetStore() {
  const byUrl = new Map() // blob URL -> { name, blob }

  function uniqueName(wanted) {
    const taken = new Set([...byUrl.values()].map((a) => a.name))
    const dot = wanted.lastIndexOf('.')
    const base = dot > 0 ? wanted.slice(0, dot) : wanted
    const ext = dot > 0 ? wanted.slice(dot) : ''
    let name = wanted
    for (let n = 2; taken.has(name); n++) name = `${base}-${n}${ext}`
    return name
  }

  function register(blob, name) {
    const url = URL.createObjectURL(blob)
    byUrl.set(url, { name, blob })
    return url
  }

  function clear() {
    for (const url of byUrl.keys()) URL.revokeObjectURL(url)
    byUrl.clear()
  }

  return {
    add(blob, name = blob.name || 'image.png') {
      return register(blob, uniqueName(safeName(name)))
    },

    load(markdown, files) {
      clear()
      for (const [path, bytes] of Object.entries(files)) {
        const name = path.slice('assets/'.length)
        markdown = replaceTargets(markdown, path, register(new Blob([bytes]), name))
      }
      return markdown
    },

    async collect(markdown) {
      const files = {}
      for (const [url, { name, blob }] of byUrl) {
        const path = `assets/${name}`
        if (markdown.includes(url)) markdown = replaceTargets(markdown, url, path)
        // Kept as written by another tool (e.g. a reference-style link): still store it.
        else if (!markdown.includes(path)) continue
        files[path] = new Uint8Array(await blob.arrayBuffer())
      }
      return { markdown, files }
    },

    clear,
  }
}
