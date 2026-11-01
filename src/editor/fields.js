import { Node, Extension, InputRule, mergeAttributes } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { MarkdownManager } from '@tiptap/markdown'
import FieldView from '../components/FieldView.vue'

// Script fields: `{{ code }}` anywhere in the text (body, headers/footers, notes, captions, tables)
// is an inline atom `field` {code}, drawn as the result of running the code (utils/scripts.js).
// Escape: `\{{` is a literal "{{" (Markdown's backslash escape); text "{{" is saved that way, and
// typing `\{{ … }}` in the page gives the literal text.

const FIELD = /^\{\{([\s\S]+?)\}\}/
export const showCode = (code) => `{{ ${code} }}`

const key = new PluginKey('fieldValues')
// Each field's value, in a decoration's spec (FieldView reads it). editor.storage.field.text(code, pos)
// gives it; the body's App.vue sets it, the default shows the code (header/footer and note editors).
function values(doc, text) {
  const list = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'field') list.push(Decoration.node(pos, pos + node.nodeSize, {}, { field: true, value: text(node.attrs.code, pos) }))
  })
  return DecorationSet.create(doc, list)
}

export const Field = Node.create({
  name: 'field',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes: () => ({
    code: { default: '', parseHTML: (el) => el.getAttribute('data-code') ?? '', renderHTML: (a) => ({ 'data-code': a.code }) },
  }),
  addStorage: () => ({ text: showCode }),
  parseHTML: () => [{ tag: 'span.field[data-code]' }],
  // Rendered HTML (copy, scripts off) shows the code; slots and notes swap in values (fillFields).
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { class: 'field' }), showCode(node.attrs.code)],
  // Events inside the popup belong to its code field, not ProseMirror.
  // Tiptap re-renders a Vue node view for a new node only; the value lives in its decorations.
  addNodeView: () => VueNodeViewRenderer(FieldView, {
    stopEvent: ({ event }) => !!event.target.closest?.('.html-pop'),
    update: ({ oldNode, newNode, updateProps }) => newNode.type === oldNode.type && (updateProps(), true),
  }),

  markdownTokenName: 'field',
  markdownTokenizer: {
    name: 'field',
    level: 'inline',
    start: (src) => src.indexOf('{{'),
    tokenize(src) {
      const m = FIELD.exec(src)
      if (m) return { type: 'field', raw: m[0], code: m[1].trim() }
    },
  },
  parseMarkdown: (token, h) => h.createNode('field', { code: token.code }),
  // An empty field (closed without code) is dropped: `{{  }}` would come back as text.
  renderMarkdown: (node) => (node.attrs.code.trim() ? showCode(node.attrs.code.trim()) : ''),

  addInputRules() {
    return [
      // `\{{ … }}` typed: the literal text, backslash dropped.
      new InputRule({
        find: /\\(\{\{.+?\}\})$/,
        handler: ({ state, range, match }) => { state.tr.insertText(match[1], range.from, range.to) },
      }),
      new InputRule({
        find: /(?<!\\)\{\{((?:(?!\{\{).)+?)\}\}$/, // from the last `{{`
        handler: ({ state, range, match }) => {
          if (!match[1].trim()) return null
          state.tr.replaceWith(range.from, range.to, this.type.create({ code: match[1].trim() }))
        },
      }),
    ]
  },

  addCommands() {
    return {
      insertField: (code = '') => ({ commands }) => commands.insertContent({ type: this.name, attrs: { code } }),
      // Values depend on more than the doc (page breaks, the document script): redraw them.
      refreshFields: () => ({ tr, dispatch, editor }) => {
        if (!dispatch) return true
        dispatch(tr.setMeta(key, true).setMeta('addToHistory', false))
        editor.emit('fields') // for values drawn outside the doc (ReferencesView)
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const text = (code, pos) => this.storage.text(code, pos)
    return [
      new Plugin({
        key,
        state: {
          init: (_, { doc }) => values(doc, text),
          apply: (tr, set) => (tr.docChanged || tr.getMeta(key) ? values(tr.doc, text) : set),
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ]
  },
})

// Tiptap marks only text nodes when parsing, so `**{{ title }}**` would lose its bold. On the
// prototype: the initial content is parsed before any extension could patch its editor's manager.
const applyMark = MarkdownManager.prototype.applyMarkToContent
MarkdownManager.prototype.applyMarkToContent = function (type, content, attrs) {
  const mark = attrs ? { type, attrs } : { type }
  return applyMark.call(this, type, content, attrs).map((n) => (n.type === 'field' ? { ...n, marks: [...(n.marks ?? []), mark] } : n))
}

// Text "{" before "{" is saved as "\{", so typed braces never reopen as a field.
// Saving also closes marks around non-text nodes (`**x **{{ u }}**`), so each field is saved as a
// placeholder text with its marks, then its code put in. After DirectionMarkdown, which creates the manager.
const HOLE = /(\d+)/g
export const FieldMarkdown = Extension.create({
  name: 'fieldMarkdown',
  onBeforeCreate() {
    const manager = this.editor.markdown
    const escape = manager.escapeMarkdownSyntax.bind(manager)
    manager.escapeMarkdownSyntax = (text) => escape(text).replace(/\{(?=\{)/g, '\\{')
    const serialize = manager.serialize.bind(manager)
    manager.serialize = (json) => {
      const codes = []
      const holes = fillFields(json, (code) => (code.trim() ? `${codes.push(code.trim()) - 1}` : ''))
      return serialize(holes).replace(HOLE, (_, i) => showCode(codes[i]))
    }
  },
})

// Doc JSON with every field replaced by its text run(code) (marks kept; empty results dropped),
// for HTML drawn outside an editor: header/footer slots and notes.
export function fillFields(node, run) {
  if (node.type === 'field') {
    const text = run(node.attrs?.code ?? '')
    return text ? { type: 'text', text, ...(node.marks && { marks: node.marks }) } : null
  }
  return node.content ? { ...node, content: node.content.map((n) => fillFields(n, run)).filter(Boolean) } : node
}

// Text with `{{ }}` in it (the scripts panel's snippets) as inline content: text and field nodes.
export const fieldContent = (text) =>
  text.split(/(\{\{[\s\S]+?\}\})/).filter(Boolean).map((part) => {
    const m = FIELD.exec(part)
    return m ? { type: 'field', attrs: { code: m[1].trim() } } : { type: 'text', text: part }
  })
