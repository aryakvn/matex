import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection, NodeSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { escapeAttrs } from './ids.js'

// Captions and cross-references for images, tables and HTML blocks (shapes, SVG drawings).
// A caption is a block under its media whose text starts with its label: "fig-1: A map of Tehran".
// It also has a fixed key (IMG-1, TBL-1, SHP-1) that references point at, so the label is just
// text: rename it and every reference follows. In Markdown:
//
//   : fig-1: A map of Tehran {#IMG-1}      (the caption line, Pandoc-like)
//   As [IMG-1] shows, …                    (a reference; shown as "fig-1")

const PREFIX = { image: 'IMG', table: 'TBL', htmlBlock: 'SHP' }
const LABEL = { IMG: 'fig', TBL: 'tbl', SHP: 'shape' }
const KEY = '(?:IMG|TBL|SHP)-\\d+'
const CAPTION = new RegExp(`^: ?(.*?)[ \\t]*\\{#(${KEY})\\}[ \\t]*(?:\\n+|$)`)
// Not a link, span or reference-style link: `[IMG-1](…)`, `[IMG-1]{#x}`, `[IMG-1][x]`, `[IMG-1]: …`.
const REF = new RegExp(`\\[(${KEY})\\](?![({\\[:])`)

// The label: the caption's text up to its first ':' ("fig-1: A map" → "fig-1"), or null without one.
export function labelOf(caption) {
  let text = ''
  for (const child of caption.content.content) {
    if (!child.isText) return null
    const i = child.text.indexOf(':')
    if (i >= 0) return text + child.text.slice(0, i)
    text += child.text
  }
  return null
}

// Every caption in order: [{ ref, label, text, pos }].
export function captionEntries(doc) {
  const list = []
  doc.descendants((node, pos) => {
    if (node.type.name !== 'caption') return
    list.push({ ref: node.attrs.ref, label: labelOf(node)?.trim() ?? '', text: node.textContent, pos })
    return false
  })
  return list
}

// Next free key for a prefix: IMG-3 after IMG-1 and IMG-2.
function nextKey(doc, prefix) {
  let max = 0
  for (const { ref } of captionEntries(doc)) {
    const m = new RegExp(`^${prefix}-(\\d+)$`).exec(ref ?? '')
    if (m) max = Math.max(max, +m[1])
  }
  return `${prefix}-${max + 1}`
}

// The image, table or HTML block the selection is on (a selected image/block, or the cursor in a table).
export function mediaAt(state) {
  const { selection } = state
  if (selection instanceof NodeSelection && PREFIX[selection.node.type.name]) return { node: selection.node, pos: selection.from }
  const { $from } = selection
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return { node: $from.node(d), pos: $from.before(d) }
  }
  return null
}

const labelsKey = new PluginKey('captionLabels')
// References show their caption's label (CSS `attr(data-label)`), "??" when it has none or is gone;
// each caption's label gets `.caption-label`. Decorations, so renaming never touches the references.
function labelDecorations(doc) {
  const labels = new Map(captionEntries(doc).map((c) => [c.ref, c.label]))
  const list = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'mediaRef') list.push(Decoration.node(pos, pos + node.nodeSize, { 'data-label': labels.get(node.attrs.ref) || '??' }))
    if (node.type.name !== 'caption') return
    const label = labelOf(node)
    if (label) list.push(Decoration.inline(pos + 1, pos + 1 + label.length, { class: 'caption-label' }))
    return false
  })
  return DecorationSet.create(doc, list)
}

// A copied caption (paste, duplicate) gets a fresh key; the first keeps it, so references stay on it.
function freshKeys(trs, old, state) {
  if (!trs.some((tr) => tr.docChanged)) return
  const seen = new Set()
  const { tr } = state
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'caption') return
    const { ref } = node.attrs
    if (!ref || seen.has(ref)) tr.setNodeAttribute(pos, 'ref', nextKey(tr.doc, (ref ?? 'IMG').split('-')[0]))
    seen.add(tr.doc.nodeAt(pos).attrs.ref)
    return false
  })
  return tr.docChanged ? tr : null
}

const refAttr = {
  ref: { default: null, parseHTML: (el) => el.getAttribute('data-ref'), renderHTML: (attrs) => ({ 'data-ref': attrs.ref }) },
}

export const Caption = Node.create({
  name: 'caption',
  group: 'block',
  // One line in Markdown, so no hard breaks.
  content: '(text | note | mediaRef)*',

  addAttributes: () => refAttr,
  parseHTML: () => [{ tag: 'p[data-ref]', priority: 60 }],
  renderHTML: ({ HTMLAttributes }) => ['p', mergeAttributes(HTMLAttributes, { class: 'caption' }), 0],

  markdownTokenName: 'caption',
  markdownTokenizer: {
    name: 'caption',
    level: 'block',
    // Only at a line start (see NoteDefinition in notes.js).
    start: (src) => {
      const match = new RegExp(`\\n: .*\\{#${KEY}\\}`).exec(src)
      return match ? match.index + 1 : -1
    },
    tokenize(src, tokens, helper) {
      const match = CAPTION.exec(src)
      if (match) return { type: 'caption', raw: match[0], ref: match[2], tokens: helper.inlineTokens(match[1]) }
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('caption', { ref: token.ref }, helpers.parseInline(token.tokens || [])),
  renderMarkdown: (node, h) => `: ${escapeAttrs(h.renderChildren(node))} {#${node.attrs.ref}}`,

  addCommands() {
    return {
      // Caption under the selected image/table/HTML block, prefilled "fig-N: ", cursor at its end.
      insertCaption: () => ({ state, tr, dispatch }) => {
        const media = mediaAt(state)
        if (!media) return false
        const at = media.pos + media.node.nodeSize
        if (state.doc.resolve(at).nodeAfter?.type.name === this.name) return false
        const prefix = PREFIX[media.node.type.name]
        const count = captionEntries(state.doc).filter((c) => c.ref?.startsWith(`${prefix}-`)).length
        const text = `${LABEL[prefix]}-${count + 1}: `
        if (dispatch) {
          tr.insert(at, this.type.create({ ref: nextKey(state.doc, prefix) }, state.schema.text(text)))
          tr.setSelection(TextSelection.create(tr.doc, at + 1 + text.length)).scrollIntoView()
        }
        return true
      },
    }
  },

  addProseMirrorPlugins: () => [
    new Plugin({
      key: labelsKey,
      state: {
        init: (_, { doc }) => labelDecorations(doc),
        apply: (tr, set) => (tr.docChanged ? labelDecorations(tr.doc) : set),
      },
      props: { decorations: (state) => labelsKey.getState(state) },
      appendTransaction: freshKeys,
    }),
  ],
})

// A reference to a caption, by key. Typing `[IMG-1]` makes one too.
// ponytail: literal "[IMG-1]" text reopens as a reference; escape it on save if that ever bites.
export const MediaRef = Node.create({
  name: 'mediaRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: () => refAttr,
  parseHTML: () => [{ tag: 'span.media-ref[data-ref]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { class: 'media-ref' })],

  markdownTokenName: 'mediaRef',
  markdownTokenizer: {
    name: 'mediaRef',
    level: 'inline',
    start: (src) => src.search(REF),
    tokenize(src) {
      const match = new RegExp(`^${REF.source}`).exec(src)
      if (match) return { type: 'mediaRef', raw: match[0], ref: match[1] }
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('mediaRef', { ref: token.ref }),
  renderMarkdown: (node) => `[${node.attrs.ref}]`,

  addInputRules() {
    return [nodeInputRule({ find: new RegExp(`\\[(${KEY})\\]$`), type: this.type, getAttributes: (m) => ({ ref: m[1] }) })]
  },

  addCommands() {
    return {
      insertMediaRef: (ref) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { ref } }),
    }
  },
})

export const captionExtensions = [Caption, MediaRef]
