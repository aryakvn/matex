import { describe, it, expect } from 'vitest'
import { defaultStyles, normalizeStyles, stylesCss } from '../src/utils/styles.js'
import { persianRuns } from '../src/editor/persian.js'
import { slotHtml } from '../src/editor/slots.js'
import { defaultLayout, normalizeLayout, isDefaultLayout } from '../src/utils/layout.js'
import { pack, unpack } from '../src/utils/archive.js'

describe('paragraph styles', () => {
  it('normalizes junk, clamps sizes and strips characters that could break the CSS', () => {
    expect(normalizeStyles(null)).toEqual(defaultStyles())
    const s = normalizeStyles({ p: { latin: 'Evil"; } body { x', size: 900, color: 'red', bold: 'yes' }, h1: { size: 20 } })
    expect(s.p.latin).toBe('Evil  body  x')
    expect(s.p.size).toBe(96)
    expect(s.p.color).toBe('#1a1a1a')
    expect(s.p.bold).toBe(false)
    expect(s.h1.persianSize).toBe(20) // follows the size when not given
  })

  it('gives each style a Latin and a Persian font; empty heading fonts inherit Normal', () => {
    const s = defaultStyles()
    Object.assign(s.p, { latin: 'Times New Roman', persian: 'B Nazanin', size: 12, persianSize: 14 })
    s.h1.persian = 'B Titr'
    const css = stylesCss(s)
    expect(css).toMatch(/^\.page \{ font-family: "Times New Roman", [^;]+; --fa-font: "B Nazanin", [^;]+; --fa-scale: 1\.1667; font-size: 12pt;/m)
    const h1 = css.split('\n').find((l) => l.startsWith('.page h1 '))
    expect(h1).not.toMatch(/font-family/)
    expect(h1).toMatch(/--fa-font: "B Titr"/)
    expect(h1).toMatch(/--fa-scale: 1;/)
    expect(css).toMatch(/\.page code \{ font-family: "Consolas"/)
  })

  it('saves styles in page.json and only when changed', () => {
    expect(isDefaultLayout(normalizeLayout({}))).toBe(true)
    const l = defaultLayout()
    l.styles.p.persian = 'Vazirmatn'
    expect(unpack(pack({ markdown: 'x', files: {}, layout: l })).layout.styles.p.persian).toBe('Vazirmatn')
  })
})

describe('Persian runs', () => {
  const runs = (t) => persianRuns(t).map((r) => (r.fa ? `[${r.text}]` : r.text)).join('')

  it('keeps spaces, ZWNJ and punctuation between Persian words in one run', () => {
    expect(runs('سلام دنیا، می‌روم.')).toBe('[سلام دنیا، می‌روم].')
    expect(runs('Hello سلام world')).toBe('Hello [سلام] world')
    expect(runs('سال 1400 بود')).toBe('[سال] 1400 [بود]')
    expect(runs('۱۴۰۰')).toBe('[۱۴۰۰]')
    expect(runs('plain')).toBe('plain')
  })

  it('marks Persian in rendered header/footer HTML', () => {
    expect(slotHtml('Page **صفحه** x')).toMatch(/<strong class="bold"><span class="persian">صفحه<\/span><\/strong>/)
  })
})
