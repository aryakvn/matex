import { Node, mergeAttributes } from '@tiptap/core'
import Heading from '@tiptap/extension-heading'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import TocView from '../components/TocView.vue'
import { withDirMark } from './direction.js'
import { attrBlock, escapeAttrs } from './ids.js'

// Heading with an `unlisted` flag, saved as `## Title {.unlisted}` (Pandoc), and a saved `id` (ids.js),
// together `## Title {#id .unlisted}`. ids.js parses both. Classes `heading heading-<level>`.
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
  renderHTML({ node, HTMLAttributes }) {
    return this.parent({ node, HTMLAttributes: mergeAttributes(HTMLAttributes, { class: `heading heading-${node.attrs.level}` }) })
  },
  renderMarkdown(node, h, ctx) {
    const md = withDirMark(this.parent(node, h, ctx), node.attrs?.dir)
    return md && escapeAttrs(md) + attrBlock(node.attrs)
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
