// Page layout: header/footer zones and page numbers. Stored as page.json inside the .matex archive.
// A zone's height is the page margin on that side, so resizing it also moves the body text.
// Each zone has three slots (left, centre, right); the page number is merged into one of them.

export const NUMBER_FORMATS = [
  { value: 'n', label: '1', template: '{n}' },
  { value: 'page', label: 'Page 1', template: 'Page {n}' },
  { value: 'of', label: 'Page 1 of 9', template: 'Page {n} of {total}' },
  { value: 'slash', label: '1 / 9', template: '{n} / {total}' },
  { value: 'dash', label: '– 1 –', template: '– {n} –' },
]
export const ALIGNS = ['left', 'center', 'right']

export const defaultLayout = () => ({
  headerHeight: 25, // mm
  footerHeight: 25,
  headerSize: 10, // pt
  footerSize: 10,
  header: ['', '', ''], // left, centre, right; may use {page} and {pages}
  footer: ['', '', ''],
  number: { where: 'footer', align: 'center', format: 'n', persian: false, start: 1, skipFirst: false },
})

const num = (v, min, max, fallback) => (Number.isFinite(+v) && v !== '' && v !== null ? Math.min(max, Math.max(min, +v)) : fallback)
const slots = (v) => [0, 1, 2].map((i) => (typeof v?.[i] === 'string' ? v[i] : ''))
const pick = (v, list, fallback) => (list.includes(v) ? v : fallback)

// Accepts anything (a half-written or hand-edited page.json) and returns a valid layout.
export function normalizeLayout(raw) {
  const d = defaultLayout()
  const r = raw && typeof raw === 'object' ? raw : {}
  const n = r.number && typeof r.number === 'object' ? r.number : {}
  return {
    headerHeight: num(r.headerHeight, 5, 100, d.headerHeight),
    footerHeight: num(r.footerHeight, 5, 100, d.footerHeight),
    headerSize: num(r.headerSize, 6, 36, d.headerSize),
    footerSize: num(r.footerSize, 6, 36, d.footerSize),
    header: slots(r.header),
    footer: slots(r.footer),
    number: {
      where: pick(n.where, ['none', 'header', 'footer'], d.number.where),
      align: pick(n.align, ALIGNS, d.number.align),
      format: pick(n.format, NUMBER_FORMATS.map((f) => f.value), d.number.format),
      persian: n.persian === true,
      start: Math.round(num(n.start, -999, 9999, d.number.start)),
      skipFirst: n.skipFirst === true,
    },
  }
}

const persianDigits = (s) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])

const digitsOf = (layout) => (v) => (layout.number.persian ? persianDigits(String(v)) : String(v))

// {page} and {pages} in slot text; not the {{ page }} of a script.
export function fillTokens(layout, text, page, total) {
  const digits = digitsOf(layout)
  return text.replace(/(?<!\{)\{(page|pages)\}(?!\})/g, (_, k) => digits(k === 'page' ? page : total))
}

// The page number shown in slot i (0 left, 1 centre, 2 right) of a zone on page `page`, or ''.
export function slotNumber(layout, zone, i, page, total) {
  const { number } = layout
  if (number.where !== zone || number.align !== ALIGNS[i] || (number.skipFirst && page === 1)) return ''
  const digits = digitsOf(layout)
  const template = NUMBER_FORMATS.find((f) => f.value === number.format).template
  return template.replace('{n}', digits(number.start + page - 1)).replace('{total}', digits(total))
}

// Plain text of the three slots of a zone ('header'|'footer') on page `page` (1-based) of `total`.
export function zoneSlots(layout, zone, page, total) {
  return layout[zone].map((text, i) =>
    [fillTokens(layout, text, page, total), slotNumber(layout, zone, i, page, total)].filter(Boolean).join(' '),
  )
}

export const isDefaultLayout = (layout) => JSON.stringify(layout) === JSON.stringify(defaultLayout())
