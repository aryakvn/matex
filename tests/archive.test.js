import { describe, it, expect } from 'vitest'
import { zipSync, unzipSync, strToU8 } from 'fflate'
import { normalizeLayout } from '../src/utils/layout.js'
import { pack, unpack } from '../src/utils/archive.js'

describe('archive', () => {
  it('pack→unpack round-trips', () => {
    const markdown = '# سلام\n\n![a](assets/a.png)'
    const png = new Uint8Array([1, 2, 3])
    const out = unpack(pack({ markdown, files: { 'assets/a.png': png } }))
    expect(out.markdown).toBe(markdown)
    expect(Object.keys(out.files)).toEqual(['assets/a.png'])
    expect([...out.files['assets/a.png']]).toEqual([1, 2, 3])
  })

  it('keeps the document CSS in style.css, not page.json', () => {
    const css = '.heading-1 { color: red; }'
    const bytes = pack({ markdown: 'x', files: {}, layout: { ...normalizeLayout(null), css } })
    const entries = unzipSync(bytes)
    expect(Object.keys(entries).sort()).toEqual(['DOCUMENT.md', 'style.css'])
    expect(unpack(bytes).layout).toEqual({ ...normalizeLayout(null), css })
  })

  it('keeps the document script in script.js', () => {
    const script = 'function f() { return 1 }'
    const bytes = pack({ markdown: 'x', files: {}, layout: { ...normalizeLayout(null), script } })
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual(['DOCUMENT.md', 'script.js'])
    expect(unpack(bytes).layout).toEqual({ ...normalizeLayout(null), script })
  })

  it('keeps font files in fonts/', () => {
    const out = unpack(pack({ markdown: 'x', files: {}, fonts: { 'fonts/a.ttf': new Uint8Array([7]) } }))
    expect(Object.keys(out.files)).toEqual([])
    expect([...out.fonts['fonts/a.ttf']]).toEqual([7])
  })

  it('unpack rejects random bytes', () => {
    expect(() => unpack(strToU8('just some text'))).toThrow(/Not a MaTex document/)
  })

  it('unpack rejects zip without DOCUMENT.md', () => {
    expect(() => unpack(zipSync({ 'other.md': strToU8('x') }))).toThrow(/Not a MaTex document/)
  })
})
