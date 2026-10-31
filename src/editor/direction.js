import { Extension } from '@tiptap/core'
import { Markdown } from '@tiptap/markdown'

// Manual direction (the toolbar's ¶ buttons) overrides `dir="auto"` on a paragraph or heading.
// In the editor it is the node's `dir` attr; in Markdown it is a leading Unicode mark,
// RLM for RTL and LRM for LTR, which other dir="auto" viewers (GitHub) also obey.
const MARKS = { rtl: String.fromCharCode(0x200f), ltr: String.fromCharCode(0x200e) }
const TYPES = ['paragraph', 'heading']
// A list item's bullet and indent follow the item's own `dir`, not its paragraph's, so an item
// takes the forced direction of its first paragraph (never saved: the paragraph's mark is).
const ITEMS = ['listItem', 'taskItem']

// Markdown of a block + its direction mark (after `## ` for headings).
export function withDirMark(md, dir) {
  const mark = MARKS[dir]
  if (!mark) return md
  return /^#{1,6} /.test(md) ? md.replace(' ', ' ' + mark) : mark + md
}

// Parsed node JSON with a leading mark taken off its text and turned into `attrs.dir`.
export function takeDirMark(node) {
  const first = node?.content?.[0]
  const dir = first?.type === 'text' && Object.keys(MARKS).find((d) => first.text.startsWith(MARKS[d]))
  if (!dir) return node
  first.text = first.text.slice(1)
  // An empty paragraph saves as "&nbsp;" after the first; with a mark in front it parses as text.
  if (node.content.length === 1 && /^(\s|&nbsp;)?$/.test(first.text)) node.content = []
  else if (!first.text) node.content.shift()
  return { ...node, attrs: { ...node.attrs, dir } }
}

function takeDirMarks(node) {
  if (TYPES.includes(node.type)) node = takeDirMark(node)
  if (node.content) node.content = node.content.map(takeDirMarks)
  const dir = node.content?.[0]?.attrs?.dir
  if (ITEMS.includes(node.type) && MARKS[dir]) node = { ...node, attrs: { ...node.attrs, dir } }
  return node
}

// Lists and table cells build their paragraphs without the paragraph's own parser, so the
// marks are lifted from every Markdown parse here (initial content, setContent, paste).
export const DirectionMarkdown = Markdown.extend({
  onBeforeCreate() {
    this.parent()
    const manager = this.editor.markdown
    const parse = manager.parse.bind(manager)
    manager.parse = (md) => takeDirMarks(parse(md))
    const { content } = this.editor.options
    if (content && typeof content === 'object') this.editor.options.content = takeDirMarks(content)
  },
})

// Paragraphs and headings in the selection.
function blocksIn(state) {
  const list = []
  const { from, to } = state.selection
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (TYPES.includes(node.type.name)) list.push({ node, pos })
  })
  return list
}

// Direction of the block at the cursor: 'ltr' | 'rtl' | 'auto'.
export function directionAt(state) {
  return state.selection.$from.parent.attrs.dir ?? 'auto'
}

export const Direction = Extension.create({
  name: 'direction',
  addCommands() {
    return {
      // Force `dir` on the selected blocks; if they all have it already, go back to auto.
      toggleDirection: (dir) => ({ state, tr, dispatch }) => {
        const blocks = blocksIn(state)
        if (!blocks.length) return false
        const next = blocks.every(({ node }) => node.attrs.dir === dir) ? 'auto' : dir
        if (!dispatch) return true
        for (const { node, pos } of blocks) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, dir: next })
          const $pos = tr.doc.resolve(pos)
          if (ITEMS.includes($pos.parent.type.name) && $pos.index() === 0) tr.setNodeAttribute($pos.before(), 'dir', next)
        }
        return true
      },
    }
  },
})
