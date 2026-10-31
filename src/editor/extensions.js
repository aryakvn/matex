import StarterKit from '@tiptap/starter-kit'
import Strike from '@tiptap/extension-strike'
import Paragraph from '@tiptap/extension-paragraph'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { UnlistedHeading, TableOfContents } from './toc.js'
import { Pagination } from './pagination.js'
import { Direction, DirectionMarkdown, withDirMark } from './direction.js'
import { PersianFont } from './persian.js'
import { noteExtensions, NoteMarkdown } from './notes.js'

// A paragraph whose text starts like block syntax ("2) ", "- ", "# ", "---", 4 spaces)
// (or is "[TOC]" or "[REFERENCES]") would reopen as a list/heading/rule/code block/TOC/references list,
// so the leading character is escaped.
export function escapeBlockStart(md) {
  if (/^ {4}/.test(md)) return '&#32;' + md.slice(1)
  if (/^(#{1,6}|[>+*-])(\s|$)/.test(md) || /^([-*_])( *\1){2,} *$/.test(md) || /^\[(TOC|REFERENCES)\]\s*$/.test(md)) return '\\' + md
  return md.replace(/^(\d{1,9})([.)])(?=\s|$)/, '$1\\$2')
}

const SafeParagraph = Paragraph.extend({
  renderMarkdown(node, h, ctx) {
    return withDirMark(escapeBlockStart(this.parent(node, h, ctx)), node.attrs?.dir)
  },
})

export const extensions = [
  StarterKit.configure({ link: { openOnClick: false }, strike: false, paragraph: false, heading: false, codeBlock: false }),
  SafeParagraph,
  UnlistedHeading,
  TableOfContents,
  ...noteExtensions,
  Pagination,
  Direction,
  PersianFont,
  // Mod-Shift-S belongs to Save as, so strike moves to Mod-Shift-X.
  Strike.extend({
    addKeyboardShortcuts() { return { 'Mod-Shift-x': () => this.editor.commands.toggleStrike() } },
  }),
  Image,
  // Syntax colours from highlight.js's common languages (bundled, offline). Language comes from
  // the fence (```js); a block without one is guessed. Colours live in document.css.
  CodeBlockLowlight.configure({ lowlight: createLowlight(common) }),
  // Column widths can't be stored in Markdown, so no resizing.
  TableKit.configure({ table: { resizable: false } }),
  // ponytail: HTML with no matching extension (span, div align, mark) keeps its text but
  // loses the tag on save. Add a node/mark per HTML feature once the toolbar can make it.
  DirectionMarkdown,
  NoteMarkdown, // after DirectionMarkdown: wraps the manager it creates
]

// Spread into every `new Editor` / `useEditor`. `dir="auto"` per block = direction
// from the first strong letter, never saved. A manual override is saved (see direction.js).
export const editorOptions = { extensions, textDirection: 'auto', contentType: 'markdown' }

// Header/footer slots and note text: the body's editor without sheets, a table of contents or notes.
const bodyOnly = [Pagination, TableOfContents, ...noteExtensions, NoteMarkdown]
export const slotEditorOptions = {
  ...editorOptions,
  extensions: extensions.filter((e) => !bodyOnly.includes(e)),
}
