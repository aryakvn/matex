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

    get: (url) => byUrl.get(url) ?? null, // { name, blob } of a blob URL this store made

    clear,
  }
}

const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' }
const EXT = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }

// Name of `name` turned by `turns` quarter-turns, and the type it is re-encoded as (JPEG and WebP stay,
// anything else, SVG included, becomes PNG): photo.jpg, 1 → { name: 'photo-rot90.jpg', type: 'image/jpeg' }.
export function rotatedName(name, turns) {
  const ext = /\.(\w+)$/.exec(name)?.[1].toLowerCase()
  const type = TYPES[ext] ?? 'image/png'
  return { name: `${name.replace(/\.\w+$/, '') || 'image'}-rot${turns * 90}.${EXT[type]}`, type }
}

// The image at `url` turned `turns` quarter-turns clockwise, drawn on a canvas and re-encoded.
// Throws for an image from the web (the canvas is tainted) or one with no size (some SVGs).
export async function rotateImage(url, turns, type) {
  const img = new Image()
  img.src = url
  await img.decode()
  const { naturalWidth: w, naturalHeight: h } = img
  if (!w || !h) throw new Error('This image has no size to rotate.')
  const canvas = document.createElement('canvas')
  canvas.width = turns % 2 ? h : w
  canvas.height = turns % 2 ? w : h
  const g = canvas.getContext('2d')
  g.translate(canvas.width / 2, canvas.height / 2)
  g.rotate((turns * Math.PI) / 2)
  g.drawImage(img, -w / 2, -h / 2)
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the rotated image.'))), type, 0.95))
}
