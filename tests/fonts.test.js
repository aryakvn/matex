import { describe, it, expect } from 'vitest'
import { zlibSync } from 'fflate'
import { fontInfo } from '../src/utils/fonts.js'

// A font with only the tables fontInfo reads: name (Windows English, UTF-16BE) and OS/2.
function name(records) {
  const strings = records.map(([, text]) => new Uint8Array([...text].flatMap((c) => [0, c.charCodeAt(0)])))
  const head = 6 + records.length * 12
  const out = new Uint8Array(head + strings.reduce((n, s) => n + s.length, 0))
  const v = new DataView(out.buffer)
  v.setUint16(2, records.length)
  v.setUint16(4, head)
  let at = 0
  records.forEach(([id], i) => {
    const r = 6 + i * 12
    v.setUint16(r, 3); v.setUint16(r + 2, 1); v.setUint16(r + 4, 0x409); v.setUint16(r + 6, id)
    v.setUint16(r + 8, strings[i].length); v.setUint16(r + 10, at)
    out.set(strings[i], head + at)
    at += strings[i].length
  })
  return out
}
function os2(weight, italic) {
  const out = new Uint8Array(78)
  new DataView(out.buffer).setUint16(4, weight)
  new DataView(out.buffer).setUint16(62, italic ? 1 : 0)
  return out
}
function sfnt(tables) {
  const entries = Object.entries(tables)
  let offset = 12 + entries.length * 16
  const out = new Uint8Array(offset + entries.reduce((n, [, t]) => n + t.length, 0))
  const v = new DataView(out.buffer)
  v.setUint32(0, 0x00010000)
  v.setUint16(4, entries.length)
  entries.forEach(([tag, t], i) => {
    const r = 12 + i * 16
    out.set([...tag].map((c) => c.charCodeAt(0)), r)
    v.setUint32(r + 8, offset); v.setUint32(r + 12, t.length)
    out.set(t, offset)
    offset += t.length
  })
  return out
}
function woff(tables) {
  const entries = Object.entries(tables).map(([tag, t]) => { const z = zlibSync(t); return [tag, t, z.length < t.length ? z : t] })
  let offset = 44 + entries.length * 20
  const out = new Uint8Array(offset + entries.reduce((n, [, , z]) => n + z.length, 0))
  const v = new DataView(out.buffer)
  v.setUint32(0, 0x774f4646)
  v.setUint16(12, entries.length)
  entries.forEach(([tag, t, z], i) => {
    const r = 44 + i * 20
    out.set([...tag].map((c) => c.charCodeAt(0)), r)
    v.setUint32(r + 4, offset); v.setUint32(r + 8, z.length); v.setUint32(r + 12, t.length)
    out.set(z, offset)
    offset += z.length
  })
  return out
}

describe('fontInfo', () => {
  it('reads family, weight and italic from a TrueType font', () => {
    const bytes = sfnt({ name: name([[1, 'B Nazanin Bold'], [16, 'B Nazanin']]), 'OS/2': os2(700, true) })
    expect(fontInfo(bytes, 'whatever.ttf')).toEqual({ family: 'B Nazanin', weight: 700, style: 'italic' })
  })

  it('falls back to name id 1 without a typographic family', () => {
    const bytes = sfnt({ name: name([[1, 'Vazirmatn']]) })
    expect(fontInfo(bytes, 'x.ttf')).toEqual({ family: 'Vazirmatn', weight: 400, style: 'normal' })
  })

  it('reads a WOFF font', () => {
    const bytes = woff({ name: name([[1, 'Sahel'], [2, 'Regular Regular Regular Regular']]), 'OS/2': os2(300, false) })
    expect(fontInfo(bytes, 'x.woff')).toEqual({ family: 'Sahel', weight: 300, style: 'normal' })
  })

  it('uses the file name for WOFF2 or unreadable files', () => {
    expect(fontInfo(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0, 0]), 'Vazirmatn-Bold.woff2').family).toBe('Vazirmatn-Bold')
    expect(fontInfo(new Uint8Array([1]), 'My "Font".ttf').family).toBe('My Font')
  })
})
