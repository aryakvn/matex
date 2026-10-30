import { describe, it, expect } from 'vitest'
import { zipSync, strToU8 } from 'fflate'
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

  it('unpack rejects random bytes', () => {
    expect(() => unpack(strToU8('just some text'))).toThrow(/Not a MaTex document/)
  })

  it('unpack rejects zip without DOCUMENT.md', () => {
    expect(() => unpack(zipSync({ 'other.md': strToU8('x') }))).toThrow(/Not a MaTex document/)
  })
})
