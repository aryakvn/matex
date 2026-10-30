import StarterKit from '@tiptap/starter-kit'
import Strike from '@tiptap/extension-strike'
import Paragraph from '@tiptap/extension-paragraph'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { UnlistedHeading, TableOfContents } from './toc.js'

// A paragraph whose text starts like block syntax ("2) ", "- ", "# ", "---", 4 spaces)
// (or is "[TOC]") would reopen as a list/heading/rule/code block/table of contents,
// so the leading character is escaped.
export function escapeBlockStart(md) {
  if (/^ {4}/.test(md)) return '&#32;' + md.slice(1)
  if (/^(#{1,6}|[>+*-])(\s|$)/.test(md) || /^([-*_])( *\1){2,} *$/.test(md) || /^\[TOC\]\s*$/.test(md)) return '\\' + md
  return md.replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
}

const SafeParagraph = Paragraph.extend({
  renderMarkdown(node, h, ctx) {
    return escapeBlockStart(this.parent(node, h, ctx))
  },
})

export const extensions = [
  StarterKit.configure({ link: { openOnClick: false }, strike: false, paragraph: false, heading: false }),
  SafeParagraph,
  UnlistedHeading,
  TableOfContents,
  // Mod-Shift-S belongs to Save as, so strike moves to Mod-Shift-X.
  Strike.extend({
    addKeyboardShortcuts() { return { 'Mod-Shift-x': () => this.editor.commands.toggleStrike() } },
  }),
  Image,
  // Column widths can't be stored in Markdown, so no resizing.
  TableKit.configure({ table: { resizable: false } }),
  // ponytail: HTML with no matching extension (span, div align, mark) keeps its text but
  // loses the tag on save. Add a node/mark per HTML feature once the toolbar can make it.
  Markdown,
]

// Spread into every `new Editor` / `useEditor`. `dir="auto"` per block = direction
// from the first strong letter; it lives only in the DOM, never in the Markdown.
export const editorOptions = { extensions, textDirection: 'auto', contentType: 'markdown' }
