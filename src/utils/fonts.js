// Fonts carried inside the document (fonts/<file> in the .matex), for devices that can't install
// fonts, like an iPad. Each file is registered with the page through the FontFace API under its
// own family name, so the Styles panel uses it like an installed font, on screen and in print.
import { ref, markRaw } from 'vue'
import { unzlibSync } from 'fflate'
import { fontName } from './styles.js'

// Family, weight and style from the font's name and OS/2 tables (TrueType/OpenType, and WOFF by
// inflating its tables). WOFF2 needs Brotli, so it falls back to the file name, as does any font
// that can't be read: "Vazirmatn-Bold.woff2" → Vazirmatn-Bold.
export function fontInfo(bytes, fileName) {
  const fallback = { family: fontName(fileName.replace(/\.[^.]*$/, '')) || 'Font', weight: 400, style: 'normal' }
  try {
    const table = tables(bytes)
    const name = table('name')
    const family = name && fontName(nameString(name, 16) ?? nameString(name, 1) ?? '')
    if (!family) return fallback
    const os2 = table('OS/2')
    const weight = os2 ? new DataView(os2.buffer, os2.byteOffset).getUint16(4) || 400 : 400
    const italic = os2 && os2.byteLength > 63 ? new DataView(os2.buffer, os2.byteOffset).getUint16(62) & 1 : 0
    return { family, weight: Math.min(1000, Math.max(1, weight)), style: italic ? 'italic' : 'normal' }
  } catch {
    return fallback
  }
}

// tag → table bytes, or null.
function tables(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const woff = v.getUint32(0) === 0x774f4646 // 'wOFF'
  const count = v.getUint16(woff ? 12 : 4)
  const tag = (at) => String.fromCharCode(...bytes.subarray(at, at + 4))
  return (want) => {
    for (let i = 0; i < count; i++) {
      const at = woff ? 44 + i * 20 : 12 + i * 16
      if (tag(at) !== want) continue
      const offset = v.getUint32(at + (woff ? 4 : 8))
      const length = v.getUint32(at + (woff ? 8 : 12))
      const data = bytes.subarray(offset, offset + length)
      return woff && length < v.getUint32(at + 12) ? unzlibSync(data) : data
    }
    return null
  }
}

// Name record `id`, preferring Windows English, then any Windows, then Mac.
function nameString(t, id) {
  const v = new DataView(t.buffer, t.byteOffset, t.byteLength)
  const count = v.getUint16(2)
  const strings = v.getUint16(4)
  let best = null
  let bestRank = 0
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 12
    if (v.getUint16(at + 6) !== id) continue
    const platform = v.getUint16(at)
    const rank = platform === 3 ? (v.getUint16(at + 4) === 0x409 ? 3 : 2) : platform === 1 ? 1 : 0
    if (rank <= bestRank) continue
    const data = t.subarray(strings + v.getUint16(at + 10), strings + v.getUint16(at + 10) + v.getUint16(at + 8))
    best = platform === 3 ? new TextDecoder('utf-16be').decode(data) : String.fromCharCode(...data)
    bestRank = rank
  }
  return best?.trim() || null
}

export function createFontStore() {
  const list = ref([]) // [{ name: file name in fonts/, family, weight, style, bytes, face }]

  function forget(font) {
    document.fonts.delete(font.face)
    list.value = list.value.filter((f) => f !== font)
  }

  // Throws when the webview can't read the file as a font.
  async function add(bytes, fileName) {
    const info = fontInfo(bytes, fileName)
    const face = new FontFace(info.family, bytes, { weight: String(info.weight), style: info.style })
    await face.load()
    document.fonts.add(face)
    // Same family, weight and style again = replace it (a newer file of the same font).
    list.value.filter((f) => f.family === info.family && f.weight === info.weight && f.style === info.style).forEach(forget)
    const taken = new Set(list.value.map((f) => f.name))
    const safe = fileName.replace(/[^\w.-]+/g, '-') || 'font'
    let name = safe
    for (let n = 2; taken.has(name); n++) name = safe.replace(/(\.[^.]*)?$/, `-${n}$1`)
    const font = { name, ...info, bytes, face: markRaw(face) }
    list.value = [...list.value, font]
    return font
  }

  function clear() {
    list.value.forEach(forget)
  }

  // fonts/<file> entries of an opened archive; a damaged file is skipped, not fatal.
  async function load(files) {
    clear()
    for (const [path, bytes] of Object.entries(files)) {
      try {
        await add(bytes, path.slice('fonts/'.length))
      } catch {}
    }
  }

  const files = () => Object.fromEntries(list.value.map((f) => [`fonts/${f.name}`, f.bytes]))

  return { list, add, remove: forget, load, clear, files }
}
