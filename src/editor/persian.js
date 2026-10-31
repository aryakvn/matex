import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Persian (Arabic-script) runs get the `.persian` class, which document.css gives the paragraph style's
// Persian font (--fa-font) — Word's separate "complex script" font. Spaces, ZWNJ and punctuation
// between two Persian words stay in the run, so the words are spaced by the Persian font.
// Blocks that read right to left get `.persian` too, for the CSS panel (`.heading-1.persian`).
// Display only: the class is a decoration (editor) or a span in rendered HTML, never saved.
const RUN = /\p{scx=Arabic}(?:[\p{scx=Arabic}‌‍]|[\s\p{P}]+(?=\p{scx=Arabic}))*/gu

// Whether text reads right to left: its first letter is Hebrew or Arabic-script, as dir="auto" decides.
export const isRtl = (text) => /^[^\p{L}]*[֐-ࣿיִ-﷿ﹰ-﻿]/u.test(text)

const rtlBlock = (dir, text) => dir === 'rtl' || (dir !== 'ltr' && isRtl(text))
const BLOCKS = 'p, h1, h2, h3, h4, h5, h6, pre'

// Text split into [{ text, fa }] pieces, in order.
export function persianRuns(text) {
  const out = []
  let last = 0
  for (const m of text.matchAll(RUN)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), fa: false })
    out.push({ text: m[0], fa: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), fa: false })
  return out
}

// Wraps the Persian runs of every text node under a DOM node (for HTML not drawn by the editor),
// and marks its right-to-left blocks.
export function markPersian(root) {
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */)
  const texts = []
  while (walker.nextNode()) texts.push(walker.currentNode)
  for (const t of texts) {
    const runs = persianRuns(t.data)
    if (!runs.some((r) => r.fa)) continue
    t.replaceWith(...runs.map((r) => {
      if (!r.fa) return r.text
      const span = root.ownerDocument.createElement('span')
      span.className = 'persian'
      span.textContent = r.text
      return span
    }))
  }
  for (const el of root.querySelectorAll(BLOCKS)) if (rtlBlock(el.getAttribute('dir'), el.textContent)) el.classList.add('persian')
  return root
}

// ponytail: rescans the whole document on every edit; map the old set and rescan only changed
// blocks if long documents get slow.
function decorate(doc) {
  const decos = []
  doc.descendants((node, pos) => {
    if (node.isTextblock && rtlBlock(node.attrs.dir, node.textContent)) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'persian' }))
    if (!node.isText) return
    let at = pos
    for (const r of persianRuns(node.text)) {
      if (r.fa) decos.push(Decoration.inline(at, at + r.text.length, { class: 'persian' }))
      at += r.text.length
    }
  })
  return DecorationSet.create(doc, decos)
}

const key = new PluginKey('persianFont')

export const PersianFont = Extension.create({
  name: 'persianFont',
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      state: {
        init: (_, { doc }) => decorate(doc),
        apply: (tr, set) => (tr.docChanged ? decorate(tr.doc) : set),
      },
      props: { decorations: (state) => key.getState(state) },
    })]
  },
})
