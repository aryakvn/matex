import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { persianRuns } from './persian.js'

// Every element of the document has a class (renderHTML, see extensions.js) and an id, so the
// document's own CSS (CSS panel) can reach any of them.
// - Auto ids `<base>-<n>`: paragraph-3 is the 3rd paragraph, heading-2-1 the first h2, persian-5 the
//   5th Persian run. Counted in document order and never saved, so they shift when blocks are added above.
// - Saved ids stay put: a paragraph's or heading's `id` attr (`text {#id}`, `## Title {#id}`, Pandoc
//   style) and the `span` mark (`[text]{#id}`). pinSelection() makes them.

export const PINNED = ['paragraph', 'heading']
// Nodes whose `id` attr is saved: pinned blocks and sections (sections.js).
const SAVED = [...PINNED, 'section']
const IDENT = '[A-Za-z][\\w-]*'
const ITEM = `(?:#${IDENT}|\\.unlisted)`
// A trailing `{#id .unlisted}` attribute block (either item, any order); `]{` is a span's.
const ATTRS = new RegExp(`[ \\t]*(?<!\\])\\{\\s*${ITEM}(?:\\s+${ITEM})*\\s*\\}[ \\t]*$`)
const SPAN = new RegExp(`\\[((?:\\\\.|[^\\[\\]\\\\\\n])+)\\]\\{#(${IDENT})\\}`)

// ` {#id .unlisted}` for a block's Markdown, or ''.
export function attrBlock({ id, unlisted } = {}) {
  const items = [id && `#${id}`, unlisted && '.unlisted'].filter(Boolean)
  return items.length ? ` {${items.join(' ')}}` : ''
}

// Text that ends like an attribute block must not reopen as one.
export const escapeAttrs = (md) => md.replace(ATTRS, (m) => m.replace('{', '\\{'))

// The block's attributes as an inline placeholder, lifted onto the paragraph/heading by liftAttrs.
const AttrTokens = Extension.create({
  name: 'attrBlock',
  markdownTokenName: 'attrBlock',
  markdownTokenizer: {
    name: 'attrBlock',
    level: 'inline',
    start: (src) => src.search(ATTRS),
    tokenize(src) {
      const match = new RegExp(`^${ATTRS.source}`).exec(src)
      if (!match) return
      const items = match[0].match(new RegExp(ITEM, 'g'))
      const id = items.findLast((i) => i[0] === '#')?.slice(1) ?? null
      return { type: 'attrBlock', raw: match[0], id, unlisted: items.includes('.unlisted') }
    },
  },
  parseMarkdown: (token) => ({ type: 'attrBlock', attrs: { id: token.id, unlisted: token.unlisted } }),
})

// Placeholders out of parsed JSON; one that ends a paragraph or heading becomes its attrs. A repeated
// id is dropped, so ids stay unique.
function liftAttrs(node, seen = new Set()) {
  if (!node.content) return node
  const last = node.content.at(-1)
  let { attrs } = node
  if (last?.type === 'attrBlock' && PINNED.includes(node.type)) {
    const id = seen.has(last.attrs.id) ? null : last.attrs.id
    const unlisted = last.attrs.unlisted && node.type === 'heading'
    seen.add(id)
    attrs = { ...attrs, ...(id && { id }), ...(unlisted && { unlisted }) }
  }
  const content = node.content.filter((c) => c.type !== 'attrBlock').map((c) => liftAttrs(c, seen))
  return attrs ? { ...node, attrs, content } : { ...node, content }
}

// Copies of a saved id made while editing (paste, or a paragraph split by Enter) lose it; the first keeps it.
function dropCopies(trs, old, state) {
  if (!trs.some((tr) => tr.docChanged)) return
  const seen = new Set()
  const { tr } = state
  state.doc.descendants((node, pos) => {
    const { id } = node.attrs
    if (!SAVED.includes(node.type.name) || !id) return
    if (seen.has(id)) tr.setNodeAttribute(pos, 'id', null)
    seen.add(id)
  })
  return tr.docChanged ? tr : null
}

// Saved ids on paragraphs and headings. Wraps the Markdown manager's parse (after DirectionMarkdown),
// because list items and table cells build paragraphs without the paragraph's own parser.
export const BlockIds = Extension.create({
  name: 'blockIds',
  addExtensions: () => [AttrTokens],
  addGlobalAttributes: () => [{ types: PINNED, attributes: { id: { default: null, keepOnSplit: false } } }],
  addProseMirrorPlugins: () => [new Plugin({ appendTransaction: dropCopies })],
  onBeforeCreate() {
    const manager = this.editor.markdown
    const parse = manager.parse.bind(manager)
    manager.parse = (md) => liftAttrs(parse(md))
    const { content } = this.editor.options
    if (content && typeof content === 'object') this.editor.options.content = liftAttrs(content)
  },
})

// A run of text with a saved id: `[text]{#id}` (Pandoc's bracketed span).
// ponytail: literal "[x]{#y}" typed as text reopens as a span; escape it on save if that ever bites.
export const Span = Mark.create({
  name: 'span',
  inclusive: false,
  addAttributes: () => ({ id: { default: null } }),
  parseHTML: () => [{ tag: 'span[data-span]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-span': '', class: 'span' }), 0],

  markdownTokenName: 'span',
  markdownTokenizer: {
    name: 'span',
    level: 'inline',
    start: (src) => src.search(SPAN),
    tokenize(src, tokens, helper) {
      const match = new RegExp(`^${SPAN.source}`).exec(src)
      if (match) return { type: 'span', raw: match[0], id: match[2], tokens: helper.inlineTokens(match[1]) }
    },
  },
  parseMarkdown: (token, helpers) => helpers.applyMark('span', helpers.parseInline(token.tokens || []), { id: token.id }),
  renderMarkdown: (node, h) => `[${h.renderChildren(node)}]{#${node.attrs.id}}`,
})

const BASES = { tableOfContents: 'toc', referenceList: 'references' }
// Auto id prefix of a node: its class name (heading-2, footnote, list-item...).
export function baseOf(node) {
  const { name } = node.type
  if (name === 'heading') return `heading-${node.attrs.level}`
  if (name === 'note') return node.attrs.kind
  return BASES[name] ?? name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

// ponytail: rebuilt on every edit, like persian.js; map the old set if long documents get slow.
function idDecorations(doc) {
  const count = {}
  const next = (base) => `${base}-${(count[base] = (count[base] ?? 0) + 1)}`
  const decos = []
  doc.descendants((node, pos) => {
    if (node.isText) {
      let at = pos
      for (const r of persianRuns(node.text)) {
        if (r.fa) decos.push(Decoration.inline(at, at + r.text.length, { id: next('persian') }))
        at += r.text.length
      }
      return
    }
    const auto = next(baseOf(node))
    const id = (SAVED.includes(node.type.name) && node.attrs.id) || auto
    decos.push(Decoration.node(pos, pos + node.nodeSize, { id }))
  })
  return DecorationSet.create(doc, decos)
}

const key = new PluginKey('elementIds')

// Ids on every node of the body (not header/footer slots: those repeat on every sheet).
export const ElementIds = Extension.create({
  name: 'elementIds',
  addProseMirrorPlugins: () => [new Plugin({
    key,
    state: {
      init: (_, { doc }) => idDecorations(doc),
      apply: (tr, set) => (tr.docChanged ? idDecorations(tr.doc) : set),
    },
    props: { decorations: (state) => key.getState(state) },
  })],
})

const LETTERS = 'abcdefghijkmnopqrstuvwxyz'
// Letters only, so a saved id never equals an auto one (those end in digits).
export const newId = (base) => `${base}-${Array.from({ length: 5 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('')}`

// Ids of what is selected, made permanent where they can be: part of one paragraph's or heading's
// text becomes a span; whole paragraphs and headings get a saved id; anything else (code block,
// image, table of contents) gives its auto id. Returns the ids.
export function pinSelection(editor) {
  const { state, view } = editor
  const { from, to, empty, $from, $to } = state.selection
  const span = state.schema.marks.span
  const { tr } = state
  const ids = []
  const block = $from.parent
  const partial = !empty && $from.sameParent($to) && block.inlineContent && (from > $from.start() || to < $from.end())
  if (partial && block.type.allowsMarkType(span)) {
    let id = null // a span already in the selection keeps its id and grows over it
    state.doc.nodesBetween(from, to, (node) => { id ??= node.marks.find((m) => m.type === span)?.attrs.id ?? null })
    id ??= newId('span')
    tr.addMark(from, to, span.create({ id }))
    ids.push(id)
  } else {
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (PINNED.includes(node.type.name)) {
        let { id } = node.attrs
        if (!id) tr.setNodeAttribute(pos, 'id', (id = newId(baseOf(node))))
        ids.push(id)
        return false
      }
      if (node.isTextblock || node.isAtom) {
        const shown = view.nodeDOM(pos)?.id
        if (shown) ids.push(shown)
        return false
      }
    })
  }
  if (tr.docChanged) view.dispatch(tr)
  return ids
}
