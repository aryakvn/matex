import { Node, Extension, mergeAttributes, getHTMLFromFragment } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import ReferencesView from '../components/ReferencesView.vue'
import { markPersian, isRtl } from './persian.js'
import { fillFields, showCode } from './fields.js'

// Footnotes and references (Wikipedia style). Both are an inline `note` marker whose text is an attr;
// markers sharing an id are one note (a source cited twice). In Markdown both are Pandoc footnotes:
// `[^1]` in the text and `[^1]: text` lines at the end; references use `ref-` ids (`[^ref-1]`).
// Ids are renumbered on every save, so in memory they are anything unique.
// Footnotes print at the bottom of their sheet (App.vue + pagination.js); references in `[REFERENCES]`.

const REF = /^ref-/

// One entry per note in order of first use: [{ id, kind, text, pos, number }], numbered per kind.
export function noteEntries(doc) {
  const seen = new Map()
  const count = { footnote: 0, reference: 0 }
  doc.descendants((node, pos) => {
    if (node.type.name !== 'note' || seen.has(node.attrs.id)) return
    const { id, kind, text } = node.attrs
    seen.set(id, { id, kind, text, pos, number: ++count[kind] })
  })
  return [...seen.values()]
}

// Page (1-based) an inline marker at `pos` is on. Unlike pageOf (blocks), a break right after the
// marker leaves it on the earlier page.
export const pageAt = (breaks, pos) => 1 + breaks.filter((b) => b.pos <= pos).length

// 'rtl' if the note's first letter is Hebrew/Arabic-script, else 'ltr'. For the footnote and
// references rows: their text sits in a `dir="auto"` paragraph, which a row's own `dir="auto"` skips.
export const noteDir = (md) => (isRtl(md) ? 'rtl' : 'ltr')

// A note's Markdown text as HTML, through the body's schema; Persian runs get their font. Script
// fields become run(code) (their value on the note's sheet), else their code.
const htmlCache = new Map()
const parsedCache = new Map()
export function noteHtml(editor, md, run = showCode) {
  if (!md?.trim()) return ''
  if (htmlCache.size > 200) htmlCache.clear() // ponytail: crude bound, like slots.js
  if (parsedCache.size > 200) parsedCache.clear()
  if (!parsedCache.has(md)) parsedCache.set(md, editor.markdown.parse(md))
  const values = []
  const json = fillFields(parsedCache.get(md), (code) => values[values.push(run(code)) - 1])
  const key = `${md}\0${values.join('\0')}`
  if (!htmlCache.has(key)) {
    const doc = editor.schema.nodeFromJSON(json)
    // The body's parse wraps everything in a section (sections.js); a note is just its content.
    const body = doc.firstChild?.type.name === 'section' ? doc.firstChild.content : doc.content
    const tpl = document.createElement('template')
    tpl.innerHTML = getHTMLFromFragment(body, editor.schema)
    markPersian(tpl.content)
    htmlCache.set(key, tpl.innerHTML)
  }
  return htmlCache.get(key)
}

const numbersKey = new PluginKey('noteNumbers')
// The visible number is CSS (`attr(data-n)`) from a decoration, so renumbering never touches the doc.
function numberDecorations(doc) {
  const numbers = new Map(noteEntries(doc).map((e) => [e.id, String(e.number)]))
  const list = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'note') list.push(Decoration.node(pos, pos + node.nodeSize, { 'data-n': numbers.get(node.attrs.id) }))
  })
  return DecorationSet.create(doc, list)
}

const dataAttr = (name, fallback) => ({
  default: fallback,
  parseHTML: (el) => el.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attrs) => ({ [`data-${name}`]: attrs[name] }),
})

export const Note = Node.create({
  name: 'note',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: () => ({ kind: dataAttr('kind', 'footnote'), id: dataAttr('note', ''), text: dataAttr('text', '') }),
  parseHTML: () => [{ tag: 'sup[data-note]' }],
  renderHTML: ({ node, HTMLAttributes }) => ['sup', mergeAttributes(HTMLAttributes, { class: `note ${node.attrs.kind}` })],

  markdownTokenName: 'note',
  markdownTokenizer: {
    name: 'note',
    level: 'inline',
    start: (src) => src.indexOf('[^'),
    tokenize(src) {
      const match = /^\[\^([^\]\s\\]+)\](?!:)/.exec(src)
      if (match) return { type: 'note', raw: match[0], id: match[1] }
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('note', { id: token.id, kind: REF.test(token.id) ? 'reference' : 'footnote' }),
  renderMarkdown: (node) => `[^${node.attrs.id}]`,

  addCommands() {
    return {
      insertNote: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
      // Every marker of the note, so a source cited twice stays one source.
      setNoteText: (id, text) => ({ state, tr, dispatch }) => {
        const found = []
        state.doc.descendants((node, pos) => {
          if (node.type.name === this.name && node.attrs.id === id && node.attrs.text !== text) found.push(pos)
        })
        if (dispatch) found.forEach((pos) => tr.setNodeAttribute(pos, 'text', text))
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const { editor } = this
    return [
      new Plugin({
        key: numbersKey,
        state: {
          init: (_, state) => numberDecorations(state.doc),
          apply: (tr, set) => (tr.docChanged ? numberDecorations(tr.doc) : set),
        },
        props: {
          decorations: (state) => numbersKey.getState(state),
          // App.vue opens the note's popup.
          handleClickOn(view, pos, node, nodePos, event) {
            if (node.type.name !== 'note') return false
            editor.emit('noteClick', { id: node.attrs.id, pos: nodePos, el: view.nodeDOM(nodePos) ?? event.target })
            return true
          },
        },
        // 'notes' = the list may have changed. Also after updateState (Open/New), which skips 'update'.
        view: () => ({ update: (view, prev) => { if (!prev.doc.eq(view.state.doc)) editor.emit('notes') } }),
      }),
    ]
  },
})

// `[^id]: text` lines. They parse to a placeholder that NoteMarkdown removes, after copying the
// text into the markers, so no node type is needed.
export const NoteDefinition = Extension.create({
  name: 'noteDefinition',
  markdownTokenName: 'noteDefinition',
  markdownTokenizer: {
    name: 'noteDefinition',
    level: 'block',
    // Where a definition may cut a paragraph short: only at a line start (marked passes the
    // paragraph minus its first character, so a bare search would also hit `\[^1]:` mid-line).
    start: (src) => {
      const match = /\n\[\^[^\]\s\\]+\]:/.exec(src)
      return match ? match.index + 1 : -1
    },
    tokenize(src) {
      const match = /^\[\^([^\]\s\\]+)\]:[ \t]*([^\n]*)(?:\n+|$)/.exec(src)
      if (match) return { type: 'noteDefinition', raw: match[0], id: match[1], text: match[2].trim() }
    },
  },
  parseMarkdown: (token) => ({ type: 'noteDefinition', attrs: { id: token.id, text: token.text } }),
})

// Parsed JSON with definition placeholders taken out (into `defs`) and markers given their text.
function takeDefinitions(node, defs) {
  if (!node.content) return node
  const content = node.content.filter((child) => {
    if (child.type !== 'noteDefinition') return true
    defs.set(child.attrs.id, child.attrs.text)
    return false
  })
  return { ...node, content: content.map((child) => takeDefinitions(child, defs)) }
}
function fillNotes(node, defs) {
  if (node.type === 'note') return defs.has(node.attrs.id) ? { ...node, attrs: { ...node.attrs, text: defs.get(node.attrs.id) } } : node
  return node.content ? { ...node, content: node.content.map((child) => fillNotes(child, defs)) } : node
}
function relabel(node, labels) {
  if (node.type === 'note') return { ...node, attrs: { ...node.attrs, id: labels.get(node.attrs.id) } }
  return node.content ? { ...node, content: node.content.map((child) => relabel(child, labels)) } : node
}

// Wraps the Markdown manager (after DirectionMarkdown): parse reads definitions into markers,
// serialize renumbers the ids and appends the definitions.
export const NoteMarkdown = Extension.create({
  name: 'noteMarkdown',
  onBeforeCreate() {
    const { editor } = this
    const manager = editor.markdown
    const parse = manager.parse.bind(manager)
    const serialize = manager.serialize.bind(manager)
    const read = (json) => {
      const defs = new Map()
      return fillNotes(takeDefinitions(json, defs), defs)
    }
    manager.parse = (md) => read(parse(md))
    manager.serialize = (json) => {
      if (json?.type !== 'doc') return serialize(json)
      const entries = noteEntries(editor.schema.nodeFromJSON(json))
      if (!entries.length) return serialize(json)
      const labels = new Map(entries.map((e) => [e.id, e.kind === 'reference' ? `ref-${e.number}` : String(e.number)]))
      // Footnotes first, then references, each in number order.
      const defs = [...entries]
        .sort((a, b) => (a.kind === b.kind ? a.number - b.number : a.kind === 'footnote' ? -1 : 1))
        .map((e) => `[^${labels.get(e.id)}]: ${e.text.replace(/\s*\n\s*/g, ' ').trim()}`)
      return `${serialize(relabel(json, labels)).replace(/\s+$/, '')}\n\n${defs.join('\n\n')}`
    }
    const { content } = editor.options
    if (content && typeof content === 'object') editor.options.content = read(content)
  },
})

// The references list, saved as a `[REFERENCES]` line; lists every reference live.
export const ReferenceList = Node.create({
  name: 'referenceList',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  parseHTML: () => [{ tag: 'section[data-references]' }],
  renderHTML: () => ['section', { 'data-references': '', class: 'references' }],
  addNodeView: () => VueNodeViewRenderer(ReferencesView),

  markdownTokenName: 'referenceList',
  markdownTokenizer: {
    name: 'referenceList',
    level: 'block',
    start: (src) => src.indexOf('[REFERENCES]'),
    tokenize(src) {
      const match = /^\[REFERENCES\][ \t]*(?:\n+|$)/.exec(src)
      if (match) return { type: 'referenceList', raw: match[0] }
    },
  },
  parseMarkdown: (token, helpers) => helpers.createNode('referenceList'),
  renderMarkdown: () => '[REFERENCES]',

  addCommands() {
    return {
      insertReferenceList: () => ({ commands }) => commands.insertContent({ type: this.name }),
    }
  },
})

export const noteExtensions = [Note, NoteDefinition, ReferenceList]
