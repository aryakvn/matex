import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DOMPurify from 'dompurify'
import { TextSelection } from '@tiptap/pm/state'
import HtmlBlockView from '../components/HtmlBlockView.vue'

// Raw HTML between Markdown blocks (`<div align="center">…</div>`, `<details>`, `<svg>`), saved in
// the Markdown exactly as written and drawn live. Clicking it opens its code (HtmlBlockView.vue).
// Always sanitized when drawn, whoever wrote it: no scripts, event handlers or <style> (styling goes
// in the CSS panel), so opening someone else's document can't run code. Header/footer `{{ }}`
// stay the only scripts, and they ask first.
export const cleanHtml = (html) => DOMPurify.sanitize(html, { FORBID_TAGS: ['style'] })

// Done/Esc in a block's code popup (block at `at`): cursor into the text after the block, adding a
// paragraph when nothing follows it (the block is last), so the popup always closes.
// Size from the doc, not the node view's `props.node`: Vue's proxy breaks ProseMirror's isLeaf, so it says 2.
export function leaveBlock(editor, at) {
  const { state, view } = editor
  const pos = at + state.doc.nodeAt(at).nodeSize
  const tr = state.tr
  const next = TextSelection.findFrom(state.doc.resolve(pos), 1, true)
  if (next) tr.setSelection(next)
  else tr.insert(pos, state.schema.nodes.paragraph.create()).setSelection(TextSelection.create(tr.doc, pos + 1))
  view.dispatch(tr)
  view.focus()
}

export const HtmlBlock = Node.create({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,

  addAttributes: () => ({
    html: { default: '', parseHTML: (el) => el.getAttribute('data-html') ?? '', renderHTML: (attrs) => ({ 'data-html': attrs.html }) },
  }),
  parseHTML: () => [{ tag: 'div[data-html-block]' }],
  // Rendered HTML (header/footer slots, copy): the sanitized HTML inside, the source in data-html.
  renderHTML({ node, HTMLAttributes }) {
    const dom = document.createElement('div')
    for (const [name, value] of Object.entries(mergeAttributes(HTMLAttributes, { 'data-html-block': '', class: 'html-block' }))) dom.setAttribute(name, value)
    dom.innerHTML = cleanHtml(node.attrs.html)
    return { dom }
  },
  // Events inside the code popup belong to Monaco, not ProseMirror (clicks, drags, keys).
  addNodeView: () => VueNodeViewRenderer(HtmlBlockView, { stopEvent: ({ event }) => !!event.target.closest?.('.html-pop') }),

  // Block-level HTML only; inline HTML (`<kbd>` in a sentence) still goes through the schema.
  markdownTokenName: 'html',
  parseMarkdown: (token, helpers) => (token.block && token.raw.trim() ? helpers.createNode('htmlBlock', { html: token.raw.replace(/\s+$/, '') }) : null),
  // A blank line ends an HTML block in Markdown, so it is saved without them.
  // ponytail: also drops blank lines inside <pre>; write &#10; there if one matters.
  renderMarkdown: (node) => (node.attrs.html ?? '').replace(/\n\s*\n/g, '\n'),

  addCommands() {
    return {
      insertHtmlBlock: () => ({ commands }) => commands.insertContent({ type: this.name }),
    }
  },
})
