import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { noteEntries } from './notes.js'

// Word-style sheets (paper size from the page setup). The text stays one flow. After each layout change it is measured with the
// old breaks hidden, then a spacer goes before every line (or unsplittable block) that would cross
// a sheet's bottom margin, tall enough to land it on the next sheet's top margin.
// Sheet margins are the `.page` padding; `--page-gap` is the grey gap between sheets on screen
// (0 in print, so each sheet prints as exactly one page). The sheets themselves are drawn by App.vue.
// Footnotes print at the bottom of the sheet their marker is on, so each sheet's text area ends
// above them; their heights come from App.vue's hidden `.fn-measure` list (one item per footnote).
// Sections (sections.js): each one after the first starts on a new sheet. In a section with columns
// the browser fragments the text itself (CSS wrapped columns, one row of columns per sheet), and this
// only records where each sheet starts (breaks with height 0, no spacer).
// ponytail: re-measures the whole document after every edit; measure from the first changed block if it gets slow.

const A4_HEIGHT = (297 * 96) / 25.4 // CSS px
// Height of one sheet in CSS px: App.vue draws them; the A4 fallback is for a page without sheets.
const sheetHeight = (page, z) => (page.querySelector(':scope > .sheet')?.getBoundingClientRect().height ?? 0) / z || A4_HEIGHT
// The page's on-screen zoom (App.vue scales it with a transform). Client rects are scaled by it,
// computed styles aren't, so every rect read here is divided by it: breaks don't depend on zoom.
export const zoomOf = (el) => {
  const t = getComputedStyle(el).transform
  return t && t !== 'none' ? new DOMMatrixReadOnly(t).a || 1 : 1
}
const key = new PluginKey('pagination')

// Page (1-based) that the node at `pos` starts on, given the current breaks.
export const pageOf = (breaks, pos) => 1 + breaks.filter((b) => b.pos <= pos + 1).length

// { gap, height: Map id → px }: the footnote area's own padding/divider, and each footnote's height.
function footnoteHeights(page, z) {
  const box = page.querySelector('.fn-measure')
  const height = new Map()
  if (!box) return { gap: 0, height }
  let sum = 0
  for (const li of box.children) {
    const h = li.getBoundingClientRect().height / z
    height.set(li.dataset.note, h)
    sum += h
  }
  return { gap: box.getBoundingClientRect().height / z - sum, height }
}

function findBreaks(view, page) {
  const style = getComputedStyle(page)
  const marginTop = parseFloat(style.paddingTop)
  const marginBottom = parseFloat(style.paddingBottom)
  const gap = parseFloat(style.getPropertyValue('--page-gap')) || 0
  const z = zoomOf(page)
  const SHEET_HEIGHT = sheetHeight(page, z)
  const stride = SHEET_HEIGHT + gap
  const origin = page.getBoundingClientRect().top
  const sheetTop = (k) => k * (SHEET_HEIGHT + gap) + marginTop
  const sheetBottom = (k) => k * (SHEET_HEIGHT + gap) + SHEET_HEIGHT - marginBottom

  const notes = noteEntries(view.state.doc).filter((e) => e.kind === 'footnote')
  const fn = notes.length ? footnoteHeights(page, z) : null
  let sheetStart = 0 // doc position where the current sheet's text starts
  // Room taken on the current sheet by the footnotes whose markers sit before `to`.
  // ponytail: scans every footnote per call; index by position if documents get hundreds.
  function reserve(to) {
    let h = 0
    for (const n of notes) if (n.pos >= sheetStart && n.pos < to) h += fn.height.get(n.id) ?? 0
    return h && h + fn.gap
  }
  const limit = (to) => sheetBottom(k) - (fn ? reserve(to) : 0)

  const breaks = []
  let k = 0 // current sheet
  let shift = 0 // how far the spacers so far push the rest down
  let heading = null // the block just placed, if it's a heading that should travel with the next block
  const at = (clientY) => (clientY - origin) / z + shift

  // Spacer at `pos` moving content whose top is `top` to the next sheet. `extra` = margin the spacer
  // stops from collapsing.
  function breakAt(pos, top, inline, extra = 0) {
    const height = sheetTop(k + 1) - top - extra
    k++
    sheetStart = pos
    if (height <= 0) return // already past this sheet (after a block taller than a sheet)
    breaks.push({ pos, height: height - gap, inline })
    shift += height
  }
  // Like Word's "keep with next": a heading left alone at a sheet's bottom moves with its block.
  function breakBefore(pos, top, inline, extra) {
    if (heading?.page === k && heading.top > sheetTop(k) + 1) breakAt(heading.pos, heading.top, true)
    else breakAt(pos, top, inline, extra)
  }

  function textblock(node, pos) {
    const start = pos + 1
    const end = pos + node.nodeSize - 1
    // coordsAtPos gives the glyph box; a line box is taller by the half-leading above and below.
    // The first line box starts at the block's content top, which gives that offset (`lead`).
    // Spacers must end exactly on a line box top, or the gap drawn over them sits off the sheet gap.
    const el = view.nodeDOM(pos)
    const css = getComputedStyle(el)
    const contentTop = at(el.getBoundingClientRect().top) + parseFloat(css.borderTopWidth) + parseFloat(css.paddingTop)
    const lead = Math.max(0, at(view.coordsAtPos(start).top) - contentTop)
    const bottom = (p) => at(view.coordsAtPos(p).bottom) + lead
    let from = start
    while (bottom(end) > limit(end + 1)) {
      // First position whose line crosses the bottom margin (or the footnotes above it).
      let lo = from
      let hi = end
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (bottom(mid) > limit(mid + 1)) hi = mid
        else lo = mid + 1
      }
      // A footnote marker can make the limit move mid-line: back up to the start of that line.
      if (fn) {
        const lineTop = view.coordsAtPos(lo).top - 1
        let a = from
        while (a < lo) {
          const mid = (a + lo) >> 1
          if (view.coordsAtPos(mid).top >= lineTop) lo = mid
          else a = mid + 1
        }
      }
      const top = at(view.coordsAtPos(lo).top) - lead
      if (top <= sheetTop(k) + 1) break // a single line taller than a sheet
      if (lo === start) breakBefore(start, top, true)
      else breakAt(lo, top, true)
      from = lo
    }
    // ponytail: no widow/orphan control; a paragraph may leave one line on either sheet.
    heading = node.type.name === 'heading' && from === start ? { pos: start, top: at(view.coordsAtPos(start).top) - lead, page: k } : null
  }

  function whole(node, pos) {
    const el = view.nodeDOM(pos)
    if (!el?.getBoundingClientRect) return
    const rect = el.getBoundingClientRect()
    let prev = el.previousElementSibling
    while (prev?.classList.contains('page-gap')) prev = prev.previousElementSibling
    const extra = prev ? Math.min(parseFloat(getComputedStyle(prev).marginBottom), parseFloat(getComputedStyle(el).marginTop)) : 0
    // A caption right under an image or table moves to the next sheet with it.
    let end = pos + node.nodeSize
    let bottom = rect.bottom
    const next = view.state.doc.nodeAt(end)
    if (next?.type.name === 'caption') {
      bottom = Math.max(bottom, view.nodeDOM(end)?.getBoundingClientRect?.().bottom ?? 0)
      end += next.nodeSize
    }
    // ponytail: tables and the table of contents move whole; one taller than a sheet runs over its margin.
    while (at(bottom) > limit(end) && at(rect.top) > sheetTop(k) + 1) breakBefore(pos, at(rect.top), false, extra)
    heading = null
  }

  function visit(node, pos) {
    if (node.isTextblock) textblock(node, pos)
    else if (node.isAtom || node.type.name === 'table') whole(node, pos)
    else node.forEach((child, offset) => visit(child, pos + 1 + offset))
  }

  // A section with columns: its rows sit one per sheet, so a position's sheet is just its height.
  // ponytail: footnotes are drawn over the bottom of the columns, the text doesn't make room for them.
  function columns(section, pos) {
    const sheetOf = (p) => Math.floor(at(view.coordsAtPos(p).top) / stride)
    const reach = (p, sheet) => {
      for (; k < sheet; k++) breaks.push({ pos: p, height: 0, inline: true })
      sheetStart = p
    }
    function walk(node, p) {
      if (node.isTextblock) {
        const start = p + 1
        const end = p + node.nodeSize - 1
        while (sheetOf(end) > k) {
          let lo = start
          let hi = end
          while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (sheetOf(mid) > k) hi = mid
            else lo = mid + 1
          }
          reach(lo, sheetOf(lo))
        }
      } else if (node.isAtom || node.type.name === 'table') {
        const top = view.nodeDOM(p)?.getBoundingClientRect?.().top
        if (top != null && Math.floor(at(top) / stride) > k) reach(p, Math.floor(at(top) / stride))
      } else node.forEach((child, offset) => walk(child, p + 1 + offset))
    }
    section.forEach((child, offset) => walk(child, pos + 1 + offset))
  }

  view.state.doc.forEach((section, pos) => {
    const el = view.nodeDOM(pos)
    if (!el?.getBoundingClientRect) return
    if (pos > 0) breakAt(pos, at(el.getBoundingClientRect().top), false) // a section starts a new sheet
    heading = null
    if (getComputedStyle(el).columnWrap === 'wrap') columns(section, pos)
    else section.forEach((child, offset) => visit(child, pos + 1 + offset))
  })
  return { breaks, pages: k + 1 }
}

function spacer({ pos, height, inline }) {
  const toDOM = () => {
    const el = document.createElement(inline ? 'span' : 'div')
    el.className = 'page-gap'
    el.contentEditable = 'false'
    el.style.height = `calc(${height}px + var(--page-gap, 0px))`
    return el
  }
  return Decoration.widget(pos, toDOM, { side: -1, ignoreSelection: true, height, key: `${inline}:${height.toFixed(1)}` })
}

export const Pagination = Extension.create({
  name: 'pagination',

  addStorage: () => ({ breaks: [], pages: 1 }),

  addProseMirrorPlugins() {
    const { editor, storage } = this
    return [
      new Plugin({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            const breaks = tr.getMeta(key)
            return breaks ? DecorationSet.create(tr.doc, breaks.filter((b) => b.height > 0).map(spacer)) : set.map(tr.mapping, tr.doc)
          },
        },
        props: { decorations: (state) => key.getState(state) },
        view(view) {
          // Needs real layout: does nothing outside a `.page` or without ResizeObserver (tests).
          if (typeof ResizeObserver === 'undefined') return {}
          let frame = 0
          function run() {
            const page = view.dom.closest('.page')
            if (!page || view.isDestroyed) return
            view.dom.classList.add('paginating')
            let found
            try {
              found = findBreaks(view, page)
            } finally {
              view.dom.classList.remove('paginating')
            }
            const shown = key.getState(view.state).find()
            const spacers = found.breaks.filter((b) => b.height > 0)
            const same = shown.length === spacers.length &&
              spacers.every((b, i) => b.pos === shown[i].from && Math.abs(b.height - shown[i].spec.height) < 0.5)
            // Column breaks have no spacer to compare, so compare them with the last ones found.
            const sameCols = spacers.length === found.breaks.length ||
              (found.breaks.length === storage.breaks.length && found.breaks.every((b, i) => b.pos === storage.breaks[i].pos))
            if (same && sameCols && found.pages === storage.pages) return
            Object.assign(storage, found)
            if (!same) view.dispatch(view.state.tr.setMeta(key, found.breaks).setMeta('addToHistory', false))
            editor.emit('paginate', found)
          }
          const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(run)
          }
          storage.refresh = schedule // margins are CSS the doc doesn't know about; the page setup calls this
          // Edits re-flow the text; images loading, fonts and window width change its size.
          const resized = new ResizeObserver(schedule)
          resized.observe(view.dom)
          document.fonts?.ready.then(schedule)
          return {
            update: (v, prev) => { if (!prev.doc.eq(v.state.doc)) schedule() },
            destroy: () => {
              cancelAnimationFrame(frame)
              resized.disconnect()
            },
          }
        },
      }),
    ]
  },
})
