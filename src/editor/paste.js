import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { Slice, Fragment } from '@tiptap/pm/model'

// Clipboard HTML that carries structure or formatting. Anything else (VS Code, terminals: divs and
// coloured spans) is treated as plain text, so Markdown copied from a code editor still parses.
const STYLED = /<(p|h[1-6]|table|ul|ol|li|b|strong|i|em|u|s|a|img|pre|code|blockquote|sup|sub)\b/i

// Ctrl+V: formatted HTML pastes as is; plain text is read as Markdown (tables, lists, **bold**).
// Ctrl+Shift+V: plain text, one paragraph per line, no formatting (not even Tiptap's paste rules,
// which would bold a pasted **x**).
export const MarkdownPaste = Extension.create({
  name: 'markdownPaste',
  addProseMirrorPlugins() {
    const editor = this.editor
    let plain = false
    return [new Plugin({
      props: {
        handleDOMEvents: {
          keydown(view, e) { plain = e.shiftKey && e.code === 'KeyV'; return false },
        },
        handlePaste(view, event) {
          const wasPlain = plain
          plain = false
          const text = event.clipboardData?.getData('text/plain')
          const html = event.clipboardData?.getData('text/html')
          if (!text || view.state.selection.$from.parent.type.spec.code) return false
          if (wasPlain) view.dispatch(pastePlain(view, text))
          else if (STYLED.test(html ?? '')) return false
          else view.dispatch(pasteMarkdown(editor, view, text))
          return true
        },
      },
    })]
  },
})

// The transaction that puts `md`, parsed as Markdown, over the selection; runs transformPasted
// (sections.js unwraps the parsed sections) like a native paste.
export function pasteMarkdown(editor, view, md) {
  let slice = Slice.maxOpen(editor.schema.nodeFromJSON(editor.markdown.parse(md)).content)
  view.someProp('transformPasted', (f) => { slice = f(slice, view, true) })
  return view.state.tr.replaceSelection(slice).scrollIntoView().setMeta('paste', true).setMeta('uiEvent', 'paste')
}

// Lines as paragraphs, marked as a paste but not as a paste event, so paste rules leave it alone.
export function pastePlain(view, text) {
  const { schema } = view.state
  const blocks = text.split(/(?:\r\n?|\n)+/).map((line) => schema.nodes.paragraph.create(null, line ? schema.text(line) : null))
  return view.state.tr.replaceSelection(Slice.maxOpen(Fragment.from(blocks))).scrollIntoView().setMeta('paste', true)
}
