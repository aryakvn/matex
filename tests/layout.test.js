import { describe, it, expect } from 'vitest'
import { defaultLayout, normalizeLayout, zoneSlots, isDefaultLayout, sheetSize } from '../src/utils/layout.js'
import { pack, unpack } from '../src/utils/archive.js'

describe('layout', () => {
  it('normalizes junk to a valid layout and clamps sizes', () => {
    expect(isDefaultLayout(normalizeLayout(null))).toBe(true)
    const l = normalizeLayout({ headerHeight: 9999, footerSize: 'x', number: { where: 'moon', start: '3' } })
    expect(l.headerHeight).toBe(100)
    expect(l.footerSize).toBe(10)
    expect(l.number.where).toBe('footer')
    expect(l.number.start).toBe(3)
  })

  it('reads paper, side margins and column gap, and turns the sheet for landscape', () => {
    const l = normalizeLayout({ paper: 'A5', landscape: true, marginLeft: -3, columnGap: 999 })
    expect(sheetSize(l)).toEqual({ width: 210, height: 148 })
    expect([l.marginLeft, l.marginRight, l.columnGap]).toEqual([0, 20, 50])
    expect(sheetSize(normalizeLayout({ paper: 'Moon' }))).toEqual({ width: 210, height: 297 })
  })

  it('puts the page number in the chosen slot, with start, format, digits and skip-first', () => {
    const l = defaultLayout()
    l.footer = ['L', '', 'p{page}/{pages}']
    Object.assign(l.number, { align: 'right', format: 'of', start: 5 })
    expect(zoneSlots(l, 'footer', 2, 9)).toEqual(['L', '', 'p2/9 Page 6 of 9'])
    expect(zoneSlots(l, 'header', 2, 9)).toEqual(['', '', ''])
    Object.assign(l.number, { persian: true, skipFirst: true })
    expect(zoneSlots(l, 'footer', 1, 9)[2]).toBe('p۱/۹')
  })

  it('saves the layout in the archive only when it is not the default', () => {
    expect(unpack(pack({ markdown: 'x', files: {}, layout: defaultLayout() })).layout).toBeNull()
    const l = defaultLayout()
    l.header[1] = 'Thesis'
    expect(unpack(pack({ markdown: 'x', files: {}, layout: l })).layout).toEqual(l)
  })
})
