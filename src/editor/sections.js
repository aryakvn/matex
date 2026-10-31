import { Node, Extension, mergeAttributes } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import { TextSelection } from '@tiptap/pm/state'
import { canSplit } from '@tiptap/pm/transform'
import { newId } from './ids.js'

// Sections, like Word's "next page" section breaks: the body is one or more `section` nodes, each
// starting on a new sheet with its own number of columns and, through its id, its own CSS
// (`#appendix p { … }` in the CSS panel). Saved as Pandoc fenced divs:
//
//   ::: {#appendix .section columns=2}
//   …blocks…
//   :::
//
// The first section is written without a fence when it has no settings, so a document without
// sections is plain Markdown. Pagination (pagination.js) starts each section on a new sheet.

export const MAX_COLUMNS = 4
const clampColumns = (n) => Math.min(MAX_COLUMNS, Math.max(1, Math.round(+n) || 1))

// `#id .section columns=2` → { id, columns }, or null without the `.section` class.
function readAttrs(text) {
  const items = text.trim().split(/\s+/)
  if (!items.includes('.section') && !(items.length === 1 && items[0] === 'section')) return null
  const id = items.find((i) => /^#[A-Za-z][\w-]*$/.test(i))?.slice(1) ?? null
  const cols = items.map((i) => /^columns=["']?(\d+)["']?$/.exec(i)).find(Boolean)
  return { id, columns: clampColumns(cols?.[1] ?? 1) }
}

// `{#id .section columns=2}`
const fence = ({ id, columns }) => `{${[id && `#${id}`, '.section', columns > 1 && `columns=${columns}`].filter(Boolean).join(' ')}}`

const OPEN = /^:{3,}[ \t]*(?:\{([^}\n]*)\}|(section))[ \t]*(?:\n|$)/
const CLOSE = /^:{3,}[ \t]*$/
const CODE_FENCE = /^ {0,3}(`{3,}|~{3,})/

// Index of the closing `:::` line, skipping code blocks (a `:::` line inside one is code); -1 if none.
function closingLine(lines) {
  let code = null
  for (let i = 0; i < lines.length; i++) {
    const f = CODE_FENCE.exec(lines[i])
    if (code) {
      if (f && f[1][0] === code[0] && f[1].length >= code.length && !lines[i].trim().slice(f[1].length).trim()) code = null
    } else if (f) code = f[1]
    else if (CLOSE.test(lines[i])) return i
  }
  return -1
}

export const Section = Node.create({
  name: 'section',
  content: 'block+',

  addAttributes: () => ({
    id: { default: null },
    columns: {
      default: 1,
      parseHTML: (el) => clampColumns(el.dataset.columns),
      renderHTML: ({ columns }) => (columns > 1 ? { 'data-columns': columns, class: 'cols', style: `--columns: ${columns}` } : {}),
    },
  }),
  parseHTML: () => [{ tag: 'section[data-section]' }],
  renderHTML: ({ HTMLAttributes }) => ['section', mergeAttributes(HTMLAttributes, { 'data-section': '', class: 'section' }), 0],

  markdownTokenName: 'section',
  markdownTokenizer: {
    name: 'section',
    level: 'block',
    // Only at a line start: marked passes a paragraph minus its first character, so a bare search
    // would also cut `\:::` text (see NoteDefinition in notes.js).
    start: (src) => {
      const match = /\n:{3,}/.exec(src)
      return match ? match.index + 1 : -1
    },
    tokenize(src, tokens, helper) {
      const open = OPEN.exec(src)
      const attrs = open && readAttrs(open[1] ?? open[2])
      if (!attrs) return
      const rest = src.slice(open[0].length)
      const lines = rest.split('\n')
      const end = closingLine(lines)
      // No closing line: the section runs to the end of the document.
      const inner = end < 0 ? rest : lines.slice(0, end).join('\n')
      const consumed = end < 0 ? rest : lines.slice(0, end + 1).join('\n')
      const raw = open[0] + consumed + /^\n*/.exec(rest.slice(consumed.length))[0]
      return { type: 'section', raw, attrs, tokens: helper.blockTokens(inner) }
    },
  },
  parseMarkdown: (token, h) => h.createNode('section', token.attrs, (h.parseBlockChildren ?? h.parseChildren)(token.tokens || [])),
  renderMarkdown(node, h, ctx) {
    const body = h.renderChildren(node.content ?? [], '\n\n')
    const attrs = { id: node.attrs?.id ?? null, columns: node.attrs?.columns ?? 1 }
    if (ctx.index === 0 && !attrs.id && attrs.columns === 1) return body
    return `::: ${fence(attrs)}\n\n${body}\n\n:::`
  },

  addCommands() {
    return {
      // Section break at the cursor: what follows starts a new section (same columns, no id) on a new sheet.
      insertSection: () => ({ state, tr, dispatch }) => {
        if (!sectionAt(state)) return false
        if (!dispatch) return true
        tr.deleteSelection()
        const { $from } = tr.selection
        const d = sectionDepth($from)
        const section = $from.node(d)
        const next = { type: section.type, attrs: { ...section.attrs, id: null } }
        // One entry per level split, outermost first; null = copy that level.
        const after = (depth) => [next, ...Array(depth - 1).fill(null)]
        // Split the text at the cursor; failing that (a table, an image), after the block the cursor is in.
        let pos = $from.pos
        let depth = $from.depth - d + 1
        if (!canSplit(tr.doc, pos, depth, after(depth))) {
          pos = $from.after(d + 1)
          depth = 1
        }
        if (canSplit(tr.doc, pos, depth, after(depth))) tr.split(pos, depth, after(depth))
        else {
          // At the section's end: a new section with an empty paragraph.
          pos = $from.after(d)
          tr.insert(pos, section.type.create(next.attrs, state.schema.nodes.paragraph.create()))
        }
        tr.setSelection(TextSelection.near(tr.doc.resolve(tr.mapping.map(pos))))
        return true
      },
      setSectionColumns: (columns) => ({ state, tr, dispatch }) => {
        const at = sectionAt(state)
        if (!at) return false
        if (dispatch) tr.setNodeAttribute(at.pos, 'columns', clampColumns(columns))
        return true
      },
      // Joins the cursor's section to the one before it, which keeps its settings (like Backspace at its start).
      removeSectionBreak: () => ({ state, tr, dispatch }) => {
        const at = sectionAt(state)
        if (!at || at.index === 0) return false
        if (dispatch) tr.join(at.pos)
        return true
      },
    }
  },
})

const sectionDepth = ($pos) => {
  for (let d = $pos.depth; d > 0; d--) if ($pos.node(d).type.name === 'section') return d
  return null
}

// The section the cursor is in: { node, pos, index } (index 0 = first), or null (header/footer editors).
export function sectionAt(state) {
  const { $from } = state.selection
  const d = sectionDepth($from)
  return d == null ? null : { node: $from.node(d), pos: $from.before(d), index: $from.index(d - 1) }
}

// Gives the cursor's section a saved id, if it has none, and returns it (for the CSS panel).
export function pinSection(editor) {
  const at = sectionAt(editor.state)
  if (!at) return null
  if (at.node.attrs.id) return at.node.attrs.id
  const id = newId('section')
  editor.view.dispatch(editor.state.tr.setNodeAttribute(at.pos, 'id', id))
  return id
}

const isEmpty = (node) => node.type === 'paragraph' && !node.content?.length
const paragraph = () => ({ type: 'paragraph' })

// Parsed JSON → a doc of sections: blocks outside any fence are gathered into sections, a section
// inside another one (not written by MaTex) is unwrapped, and no section is left empty.
export function sectionize(json) {
  if (json?.type !== 'doc') return json
  const out = []
  let loose = null
  for (const node of json.content ?? []) {
    if (node.type === 'section') {
      loose = null
      const content = (node.content ?? []).flatMap((c) => (c.type === 'section' ? c.content ?? [] : [c]))
      out.push({ ...node, content: content.length ? content : [paragraph()] })
    } else {
      if (!loose) out.push((loose = { type: 'section', content: [] }))
      loose.content.push(node)
    }
  }
  // Blank lines between fences parse as empty paragraphs: not a section of their own.
  const kept = out.filter((s) => s.attrs || !s.content.every(isEmpty))
  return { ...json, content: kept.length ? kept : [{ type: 'section', content: [paragraph()] }] }
}

// The body's document: sections, not loose blocks. Header/footer and note editors keep the plain one.
export const SectionDocument = Document.extend({ content: 'section+' })

// Wraps the Markdown manager's parse, after DirectionMarkdown, NoteMarkdown and BlockIds (so note
// definitions after the last section are gone before loose blocks are gathered).
export const SectionMarkdown = Extension.create({
  name: 'sectionMarkdown',
  onBeforeCreate() {
    const manager = this.editor.markdown
    const parse = manager.parse.bind(manager)
    manager.parse = (md) => sectionize(parse(md))
    const { content } = this.editor.options
    if (content && typeof content === 'object') this.editor.options.content = sectionize(content)
  },
})
