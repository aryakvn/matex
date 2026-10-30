import { Node } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import TocView from '../components/TocView.vue'

// Pandoc's marker for "leave this heading out of the table of contents".
const UNLISTED = /\s*\{\.unlisted\}\s*$/

// Heading with an `unlisted` flag, saved as `## Title {.unlisted}`.
export const UnlistedHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent(),
      unlisted: {
        default: false,
        parseHTML: (el) => el.classList.contains('unlisted'),
        renderHTML: (attrs) => (attrs.unlisted ? { class: 'unlisted' } : {}),
      },
    }
  },
  parseMarkdown(token, helpers) {
    const last = token.tokens?.at(-1)
    const unlisted = last?.type === 'text' && UNLISTED.test(last.text)
    if (unlisted) last.text = last.raw = last.text.replace(UNLISTED, '')
    const node = this.parent(token, helpers)
    if (unlisted && node.type === 'heading') node.attrs = { ...node.attrs, unlisted: true }
    return node
  },
  renderMarkdown(node, h, ctx) {
    const md = this.parent(node, h, ctx)
    if (!md) return md
    if (node.attrs.unlisted) return `${md} {.unlisted}`
    // A heading that literally ends in "{.unlisted}" must not reopen as unlisted.
    return md.replace(/\{\.unlisted\}\s*$/, '\\$&')
  },
})

// Headings listed by a table of contents: [{ pos, level, text, unlisted }].
export function tocEntries(doc) {
  const list = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'heading') return
    const text = node.textContent.trim()
    if (text) list.push({ pos, level: node.attrs.level, text, unlisted: node.attrs.unlisted })
    return false
  })
  return list
}

// Printed page that a point `y` CSS px below the top of the text falls on. Mirrors the print
// rules in document.css: A4 sheets, `@page { margin: 0 }`, 20mm padding before the first line.
// ponytail: an estimate from the on-screen layout. It drifts when print moves content (a line or
// image pushed to the next sheet). Swap for real page breaks once printing paginates (TODOS).
const MM = 96 / 25.4
export const pageAt = (y) => Math.floor((20 * MM + Math.max(0, y)) / (297 * MM)) + 1

// Auto table of contents, saved as a `[TOC]` line.
export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML: () => [{ tag: 'nav[data-toc]' }],
  renderHTML: () => ['nav', { 'data-toc': '', class: 'toc' }],
  // Falls back to renderHTML when the editor isn't a Vue one (tests).
  addNodeView: () => VueNodeViewRenderer(TocView),

  markdownTokenName: 'tableOfContents',
  markdownTokenizer: {
    name: 'tableOfContents',
    level: 'block',
    start: (src) => src.indexOf('[TOC]'),
    tokenize(src) {
      const match = /^\[TOC\][ \t]*(?:\n+|$)/.exec(src)
      if (match) return { type: 'tableOfContents', raw: match[0] }
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('tableOfContents'),
  renderMarkdown: () => '[TOC]',

  addCommands() {
    return {
      insertTableOfContents: () => ({ commands }) => commands.insertContent({ type: this.name }),
    }
  },
})
