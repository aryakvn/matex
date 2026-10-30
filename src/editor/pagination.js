import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Word-style A4 sheets. The text stays one flow. After each layout change it is measured with the
// old breaks hidden, then a spacer goes before every line (or unsplittable block) that would cross
// a sheet's bottom margin, tall enough to land it on the next sheet's top margin.
// Sheet margins are the `.page` padding; `--page-gap` is the grey gap between sheets on screen
// (0 in print, so each sheet prints as exactly one page). The sheets themselves are drawn by App.vue.
// ponytail: re-measures the whole document after every edit; measure from the first changed block if it gets slow.

const SHEET_HEIGHT = (297 * 96) / 25.4 // A4 in CSS px
const key = new PluginKey('pagination')

// Page (1-based) that the node at `pos` starts on, given the current breaks.
export const pageOf = (breaks, pos) => 1 + breaks.filter((b) => b.pos <= pos + 1).length

function findBreaks(view, page) {
  const style = getComputedStyle(page)
  const marginTop = parseFloat(style.paddingTop)
  const marginBottom = parseFloat(style.paddingBottom)
  const gap = parseFloat(style.getPropertyValue('--page-gap')) || 0
  const origin = page.getBoundingClientRect().top
  const sheetTop = (k) => k * (SHEET_HEIGHT + gap) + marginTop
  const sheetBottom = (k) => k * (SHEET_HEIGHT + gap) + SHEET_HEIGHT - marginBottom

  const breaks = []
  let k = 0 // current sheet
  let shift = 0 // how far the spacers so far push the rest down
  let heading = null // the block just placed, if it's a heading that should travel with the next block
  const at = (clientY) => clientY - origin + shift

  // Spacer at `pos` moving content whose top is `top` to the next sheet. `extra` = margin the spacer
  // stops from collapsing.
  function breakAt(pos, top, inline, extra = 0) {
    const height = sheetTop(k + 1) - top - extra
    k++
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
    const bottom = (p) => at(view.coordsAtPos(p).bottom)
    let from = start
    while (bottom(end) > sheetBottom(k)) {
      // First position whose line crosses the bottom margin.
      let lo = from
      let hi = end
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (bottom(mid) > sheetBottom(k)) hi = mid
        else lo = mid + 1
      }
      const top = at(view.coordsAtPos(lo).top)
      if (top <= sheetTop(k) + 1) break // a single line taller than a sheet
      if (lo === start) breakBefore(start, top, true)
      else breakAt(lo, top, true)
      from = lo
    }
    // ponytail: no widow/orphan control; a paragraph may leave one line on either sheet.
    heading = node.type.name === 'heading' && from === start ? { pos: start, top: at(view.coordsAtPos(start).top), page: k } : null
  }

  function whole(node, pos) {
    const el = view.nodeDOM(pos)
    if (!el?.getBoundingClientRect) return
    const rect = el.getBoundingClientRect()
    let prev = el.previousElementSibling
    while (prev?.classList.contains('page-gap')) prev = prev.previousElementSibling
    const extra = prev ? Math.min(parseFloat(getComputedStyle(prev).marginBottom), parseFloat(getComputedStyle(el).marginTop)) : 0
    // ponytail: tables and the table of contents move whole; one taller than a sheet runs over its margin.
    while (at(rect.bottom) > sheetBottom(k) && at(rect.top) > sheetTop(k) + 1) breakBefore(pos, at(rect.top), false, extra)
    heading = null
  }

  function visit(node, pos) {
    if (node.isTextblock) textblock(node, pos)
    else if (node.isAtom || node.type.name === 'table') whole(node, pos)
    else node.forEach((child, offset) => visit(child, pos + 1 + offset))
  }
  view.state.doc.forEach((child, offset) => visit(child, offset))
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
            return breaks ? DecorationSet.create(tr.doc, breaks.map(spacer)) : set.map(tr.mapping, tr.doc)
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
            const same = shown.length === found.breaks.length &&
              found.breaks.every((b, i) => b.pos === shown[i].from && Math.abs(b.height - shown[i].spec.height) < 0.5)
            if (same && found.pages === storage.pages) return
            Object.assign(storage, found)
            if (!same) view.dispatch(view.state.tr.setMeta(key, found.breaks).setMeta('addToHistory', false))
            editor.emit('paginate', found)
          }
          const schedule = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(run)
          }
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
