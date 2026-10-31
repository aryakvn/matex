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
import { BlockIds, ElementIds, Span, escapeAttrs, attrBlock } from './ids.js'

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
    const md = withDirMark(escapeBlockStart(this.parent(node, h, ctx)), node.attrs?.dir)
    return node.content?.length ? escapeAttrs(md) + attrBlock(node.attrs) : md
  },
})

// Every element gets a class named after what it is, for the document's CSS (CSS panel). Headings
// (`heading heading-1`), notes (`note footnote`), the TOC and references set theirs in their own files.
const cls = (name) => ({ HTMLAttributes: { class: name } })

export const extensions = [
  StarterKit.configure({
    link: { openOnClick: false, HTMLAttributes: { class: 'link', target: '_blank', rel: 'noopener noreferrer nofollow' } },
    bold: cls('bold'), italic: cls('italic'), underline: cls('underline'), code: cls('code'),
    blockquote: cls('blockquote'), bulletList: cls('bullet-list'), orderedList: cls('ordered-list'), listItem: cls('list-item'),
    horizontalRule: cls('horizontal-rule'), hardBreak: cls('hard-break'),
    strike: false, paragraph: false, heading: false, codeBlock: false,
  }),
  SafeParagraph.configure(cls('paragraph')),
  UnlistedHeading,
  TableOfContents,
  ...noteExtensions,
  Pagination,
  Direction,
  PersianFont,
  // Mod-Shift-S belongs to Save as, so strike moves to Mod-Shift-X.
  Strike.extend({
    addKeyboardShortcuts() { return { 'Mod-Shift-x': () => this.editor.commands.toggleStrike() } },
  }).configure(cls('strike')),
  Image.configure(cls('image')),
  Span,
  // Syntax colours from highlight.js's common languages (bundled, offline). Language comes from
  // the fence (```js); a block without one is guessed. Colours live in document.css.
  CodeBlockLowlight.configure({ lowlight: createLowlight(common), ...cls('code-block') }),
  // Column widths can't be stored in Markdown, so no resizing.
  TableKit.configure({
    table: { resizable: false, ...cls('table') }, tableRow: cls('table-row'), tableCell: cls('table-cell'), tableHeader: cls('table-header'),
  }),
  // ponytail: HTML with no matching extension (span, div align, mark) keeps its text but
  // loses the tag on save. Add a node/mark per HTML feature once the toolbar can make it.
  DirectionMarkdown,
  NoteMarkdown, // after DirectionMarkdown: wraps the manager it creates
  BlockIds, // same
  ElementIds,
]

// Spread into every `new Editor` / `useEditor`. `dir="auto"` per block = direction
// from the first strong letter, never saved. A manual override is saved (see direction.js).
export const editorOptions = { extensions, textDirection: 'auto', contentType: 'markdown' }

// Header/footer slots and note text: the body's editor without sheets, a table of contents, notes or
// ids (a slot repeats on every sheet, so its ids would too).
const bodyOnly = [Pagination, TableOfContents, ...noteExtensions, NoteMarkdown, ElementIds]
export const slotEditorOptions = {
  ...editorOptions,
  extensions: extensions.filter((e) => !bodyOnly.includes(e)),
}
