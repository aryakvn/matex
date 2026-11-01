// Header/footer slot Markdown → HTML for one sheet: script fields become run(code), placeholders
// are filled in the text, the page number is added to the last line, and the result goes through the slot editor's
// schema, so a slot shows exactly what its editor can make.
import { Editor, getHTMLFromFragment } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { slotEditorOptions } from './extensions.js'
import { markPersian } from './persian.js'
import { fillFields, showCode } from './fields.js'

let converter
const parsed = new Map() // markdown → doc JSON

function parse(md) {
  converter ??= new Editor({ ...slotEditorOptions, element: null })
  if (!parsed.has(md)) {
    if (parsed.size > 200) parsed.clear() // ponytail: crude bound; typing adds one entry per keystroke
    parsed.set(md, converter.markdown.parse(md))
  }
  return parsed.get(md)
}

// A copy with fill() applied to every text; texts that become empty are dropped (ProseMirror forbids them).
function mapText(node, fill) {
  if (node.type === 'text') {
    const text = fill(node.text)
    return text ? { ...node, text } : null
  }
  return node.content ? { ...node, content: node.content.map((n) => mapText(n, fill)).filter(Boolean) } : { ...node }
}

function lastTextblock(node) {
  for (let i = (node.content?.length ?? 0) - 1; i >= 0; i--) {
    const found = lastTextblock(node.content[i])
    if (found) return found
  }
  return ['paragraph', 'heading'].includes(node.type) ? node : null
}

// Whether a slot looks different per sheet (then it is rendered per sheet).
export const isDynamic = (md) => /\{\{|\{pages?\}/.test(md)

export function slotHtml(md, fill = (t) => t, suffix = '', run = showCode) {
  if (!md.trim() && !suffix) return ''
  const doc = mapText(fillFields(parse(md), run), fill)
  doc.content ??= []
  if (suffix) {
    const block = lastTextblock(doc)
    if (block) (block.content ??= []).push({ type: 'text', text: block.content.length ? ` ${suffix}` : suffix })
    else doc.content.push({ type: 'paragraph', content: [{ type: 'text', text: suffix }] })
  }
  const html = getHTMLFromFragment(Node.fromJSON(converter.schema, doc).content, converter.schema)
  // Persian runs get their font here, as the editor's decorations give it to them while editing.
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  return markPersian(tpl.content) && tpl.innerHTML
}
