import { Extension, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { InlineMath as BaseInlineMath, BlockMath as BaseBlockMath } from '@tiptap/extension-mathematics'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import MathView from '../components/MathView.vue'

// LaTeX equations drawn by KaTeX (bundled with its fonts, offline): inline `$x^2$` and display
// `$$ … $$` blocks, Pandoc's tex_math_dollars syntax. Tiptap's nodes, with our tokenizers (theirs
// read "$5 and $10" as math), an edit popup (MathView.vue) and KaTeX output in rendered HTML
// (header/footer slots, notes, copy). trust stays off, so \href / \includegraphics can't load anything.

// LaTeX → KaTeX HTML; a syntax error is drawn as the source in red, never thrown.
export const renderMath = (latex, displayMode) =>
  katex.renderToString(latex, { displayMode, throwOnError: false, strict: 'ignore' })

// Inline: `$` + text without an unescaped `$` + `$`. Like Pandoc, no space just inside either `$`
// and no digit right after the closing one, so prices stay text.
export function matchInline(src) {
  const m = /^\$((?:\\.|[^\\$\n])+)\$/.exec(src)
  if (!m || /^\s|\s$/.test(m[1]) || /\d/.test(src[m[0].length] ?? '')) return null
  return { raw: m[0], latex: m[1] }
}

// Display: a `$$ … $$` block that is the whole block (it may span lines).
export function matchBlock(src) {
  const m = /^\$\$((?:\\[\s\S]|[^\\$])*)\$\$[ \t]*(?:\n|$)/.exec(src)
  return m && { raw: m[0], latex: m[1].trim() }
}

// Rendered HTML: the formula drawn inside, the source in data-latex (what parseHTML reads back).
function mathDom(tag, cls, latex, HTMLAttributes, displayMode) {
  const dom = document.createElement(tag)
  for (const [name, value] of Object.entries(mergeAttributes(HTMLAttributes, { class: cls }))) dom.setAttribute(name, value)
  dom.innerHTML = renderMath(latex, displayMode)
  return { dom }
}

// Events inside the popup belong to its code field, not ProseMirror.
const nodeView = () => VueNodeViewRenderer(MathView, { stopEvent: ({ event }) => !!event.target.closest?.('.html-pop') })

export const InlineMath = BaseInlineMath.extend({
  selectable: true,
  renderHTML({ node, HTMLAttributes }) {
    return mathDom('span', 'inline-math', node.attrs.latex, mergeAttributes(HTMLAttributes, { 'data-type': 'inline-math' }), false)
  },
  addNodeView: nodeView,
  // An empty equation (closed without text) is dropped on save: `$$` would reopen as text.
  renderMarkdown: (node) => (node.attrs.latex ? `$${node.attrs.latex}$` : ''),
  markdownTokenizer: {
    name: 'inlineMath',
    level: 'inline',
    start: (src) => src.indexOf('$'),
    tokenize: (src) => {
      const m = matchInline(src)
      return m && { type: 'inlineMath', ...m }
    },
  },
  addCommands() {
    return {
      ...this.parent(),
      insertInlineMath: (options = {}) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { latex: options.latex ?? '' } }),
    }
  },
})

export const BlockMath = BaseBlockMath.extend({
  selectable: true,
  renderHTML({ node, HTMLAttributes }) {
    return mathDom('div', 'block-math', node.attrs.latex, mergeAttributes(HTMLAttributes, { 'data-type': 'block-math' }), true)
  },
  addNodeView: nodeView,
  renderMarkdown: (node) => `$$\n${node.attrs.latex ?? ''}\n$$`,
  markdownTokenizer: {
    name: 'blockMath',
    level: 'block',
    // Line starts only: marked cuts the paragraph before this index, and a mid-line cut adds a line break.
    start: (src) => {
      const m = /(^|\n)\$\$/.exec(src)
      return m ? m.index + m[1].length : -1
    },
    tokenize: (src) => {
      const m = matchBlock(src)
      return m && { type: 'blockMath', ...m }
    },
  },
  addCommands() {
    return {
      ...this.parent(),
      insertBlockMath: (options = {}) => ({ commands }) => commands.insertContent({ type: this.name, attrs: { latex: options.latex ?? '' } }),
    }
  },
})

// Text `$` is saved as `\$`, so a dollar sign typed as text never reopens as an equation.
// After DirectionMarkdown, which creates the manager.
export const MathMarkdown = Extension.create({
  name: 'mathMarkdown',
  onBeforeCreate() {
    const manager = this.editor.markdown
    const escape = manager.escapeMarkdownSyntax.bind(manager)
    manager.escapeMarkdownSyntax = (text) => escape(text).replace(/\$/g, '\\$')
  },
})
