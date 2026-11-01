import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import MermaidView from '../components/MermaidView.vue'

// A Mermaid chart (flowchart, sequence, pie, gantt, …), saved as a ```mermaid fence and drawn live
// by MermaidView.vue. Mermaid (~3 MB) loads on the first chart only.
let loaded
let count = 0
function mermaid() {
  loaded ??= import('mermaid').then(({ default: m }) => {
    // strict: labels are sanitized and click handlers off, so a chart in someone else's document can't run code.
    m.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
    return m
  })
  return loaded
}

// Chart source → SVG markup; throws Mermaid's syntax error.
export async function renderMermaid(code) {
  const m = await mermaid()
  const id = `mermaid-svg-${++count}`
  try {
    return (await m.render(id, code)).svg
  } finally {
    document.getElementById(`d${id}`)?.remove() // Mermaid leaves its scratch element in <body> on errors
  }
}

export const Mermaid = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  selectable: true,
  priority: 101, // before the code block: gets first look at ``` fences and <pre>

  addAttributes: () => ({
    code: { default: '', parseHTML: (el) => el.textContent, renderHTML: () => ({}) },
  }),
  parseHTML: () => [{ tag: 'pre.mermaid', preserveWhitespace: 'full' }],
  // Rendered HTML (copy): the source, which Mermaid itself would pick up as `pre.mermaid`.
  renderHTML: ({ node, HTMLAttributes }) => ['pre', mergeAttributes(HTMLAttributes, { class: 'mermaid' }), node.attrs.code],
  // Events inside the code popup belong to Monaco, not ProseMirror.
  addNodeView: () => VueNodeViewRenderer(MermaidView, { stopEvent: ({ event }) => !!event.target.closest?.('.html-pop') }),

  markdownTokenName: 'code',
  parseMarkdown: (token, helpers) => (token.lang?.trim() === 'mermaid' && /^(```|~~~)/.test(token.raw) ? helpers.createNode('mermaid', { code: token.text ?? '' }) : null),
  renderMarkdown: (node) => `\`\`\`mermaid\n${node.attrs.code ?? ''}\n\`\`\``,

  addCommands() {
    return {
      insertMermaid: () => ({ commands }) => commands.insertContent({ type: this.name }),
    }
  },
})
