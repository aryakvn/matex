import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'

export const extensions = [
  StarterKit.configure({ link: { openOnClick: false } }),
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
