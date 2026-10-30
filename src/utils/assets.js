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

    // `markdown` is one string or a list (body + header/footer slots); returns the same shape.
    load(markdown, files) {
      clear()
      let list = [].concat(markdown)
      for (const [path, bytes] of Object.entries(files)) {
        const url = register(new Blob([bytes]), path.slice('assets/'.length))
        list = list.map((md) => replaceTargets(md, path, url))
      }
      return Array.isArray(markdown) ? list : list[0]
    },

    async collect(markdown) {
      const files = {}
      let list = [].concat(markdown)
      for (const [url, { name, blob }] of byUrl) {
        const path = `assets/${name}`
        if (list.some((md) => md.includes(url))) list = list.map((md) => replaceTargets(md, url, path))
        // Kept as written by another tool (e.g. a reference-style link): still store it.
        else if (!list.some((md) => md.includes(path))) continue
        files[path] = new Uint8Array(await blob.arrayBuffer())
      }
      return { markdown: Array.isArray(markdown) ? list : list[0], files }
    },

    clear,
  }
}
