// The MCP server (desktop app): lets an AI agent read and edit the open document. On/off is
// remembered per machine; the protocol is utils/mcp.js, the listening platform.js serveMcp.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { handleHttp, text, MCP_PORT } from '../utils/mcp.js'
import { serveMcp, ask, isTauri } from '../utils/platform.js'
import { scriptsIn } from '../utils/scripts.js'
import { insertMarkdown } from '../editor/paste.js'

const KEY = 'matex.mcp'
const remembered = () => { try { return localStorage.getItem(KEY) === 'on' } catch { return false } }
const remember = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* private mode */ } }

const INSTRUCTIONS = `These tools read and change the document open in MaTex, a word processor for Persian and English papers and books. \
Changes show at once in the app and the user can undo them; nothing is saved to disk (the user saves).
The body is Markdown (CommonMark, GFM tables) with MaTex extras:
- ::: {#id .section columns=2} … ::: sections, each starting a new page (the first one may be unfenced)
- footnotes [^1] and references [^ref-1], their definitions at the end; [REFERENCES] places the reference list
- captions under a figure/table/equation: ": fig-1: text {#IMG-1}"; cross-references [IMG-1], [TBL-1], [EQ-1]
- equations $x^2$ inline and $$ … $$ blocks (LaTeX, KaTeX); \`\`\`mermaid charts; [TOC] table of contents
- {{ js }} script fields (run by the app; adding one asks the user); \\{{ is literal text
- ids and classes: text {#id}, ## Heading {#id .unlisted}, [text]{#id}; images ![alt](assets/name.png){width=50%}
- a leading U+200F / U+200E forces a paragraph right-to-left / left-to-right
Prefer edit_document for changes; get_document first, since old_text must match the Markdown exactly.`

export function useMcp({ editor, assets, layout, scriptsOn }) {
  const on = ref(false)
  const error = ref('')
  let stop = null

  const body = () => editor.value ?? (() => { throw new Error('The document is not ready yet.') })()
  const read = () => assets.named(body().getMarkdown())

  // Script fields run with the app's rights, so new ones from an agent need the user's yes.
  async function allowScripts(before, after) {
    if (!scriptsOn.value) return // they would only show their code
    const known = scriptsIn(before)
    const added = [...scriptsIn(after)].filter((s) => !known.has(s))
    if (added.length && !(await ask(`An AI agent wants to add script fields to the document:\n\n${added.join('\n')}\n\nScripts can do anything this app can, including reading and writing your files. Allow them?`)))
      throw new Error('The user refused the new {{ }} script fields. Write the text without them, or escape them as \\{{.')
  }

  async function write(md) {
    await allowScripts(read(), md)
    const e = body()
    const { from } = e.state.selection
    e.commands.setContent(assets.unnamed(md), { contentType: 'markdown' }) // one undo step
    e.commands.setTextSelection(from) // clamped; keeps the user near where they were
    return 'Done.'
  }

  const tools = [
    {
      name: 'get_document',
      description: 'The whole document body as MaTex Markdown, exactly as edit_document matches it.',
      inputSchema: { type: 'object', properties: {} },
      run: read,
    },
    {
      name: 'get_selection',
      description: 'The plain text the user has selected in the document (empty when nothing is).',
      inputSchema: { type: 'object', properties: {} },
      run: () => { const { state } = body(); const { from, to } = state.selection; return state.doc.textBetween(from, to, '\n\n', ' ') },
    },
    {
      name: 'edit_document',
      description: 'Replace old_text with new_text in the document Markdown (from get_document). old_text must match exactly and be unique unless replace_all is true.',
      inputSchema: {
        type: 'object',
        properties: {
          old_text: { type: 'string', description: 'Exact Markdown to replace.' },
          new_text: { type: 'string', description: 'Markdown to put in its place.' },
          replace_all: { type: 'boolean', description: 'Replace every occurrence.' },
        },
        required: ['old_text', 'new_text'],
      },
      run(args) {
        const old = text(args, 'old_text')
        const now = text(args, 'new_text')
        if (!old) throw new Error('old_text is empty.')
        const parts = read().split(old)
        if (parts.length === 1) throw new Error('old_text is not in the document. Call get_document and copy the Markdown exactly.')
        if (parts.length > 2 && args.replace_all !== true) throw new Error(`old_text is in the document ${parts.length - 1} times. Include more text around it, or set replace_all.`)
        return write(args.replace_all === true ? parts.join(now) : parts[0] + now + parts.slice(1).join(old))
      },
    },
    {
      name: 'write_document',
      description: 'Replace the whole document body with this Markdown.',
      inputSchema: { type: 'object', properties: { markdown: { type: 'string' } }, required: ['markdown'] },
      run: (args) => write(text(args, 'markdown')),
    },
    {
      name: 'insert_markdown',
      description: "Insert Markdown at the user's cursor (replacing what is selected) or at the end of the document.",
      inputSchema: {
        type: 'object',
        properties: { markdown: { type: 'string' }, at: { type: 'string', enum: ['cursor', 'end'], description: 'Default: cursor.' } },
        required: ['markdown'],
      },
      async run(args) {
        const md = assets.unnamed(text(args, 'markdown'))
        await allowScripts(read(), md)
        const e = body()
        if (text(args, 'at', true) === 'end') {
          const blocks = [] // the sections' blocks, appended to the last section
          e.schema.nodeFromJSON(e.markdown.parse(md)).forEach((n) => (n.type.name === 'section' ? n.forEach((b) => blocks.push(b)) : blocks.push(n)))
          e.view.dispatch(e.state.tr.insert(e.state.doc.content.size - 1, blocks).scrollIntoView())
        } else e.view.dispatch(insertMarkdown(e, e.view, md))
        return 'Done.'
      },
    },
    {
      name: 'get_css',
      description: "The document's own CSS (style.css), applied over the default look on screen and in print. Rules are nested in the page; & is the page.",
      inputSchema: { type: 'object', properties: {} },
      run: () => layout.css || '(empty)',
    },
    {
      name: 'set_css',
      description: "Replace the document's CSS. Every element has a class (.paragraph, .heading-1, .table, .note, .section, .persian…) and an id.",
      inputSchema: { type: 'object', properties: { css: { type: 'string' } }, required: ['css'] },
      run: (args) => { layout.css = text(args, 'css'); return 'Done.' },
    },
  ]

  async function setOn(want) {
    error.value = ''
    if (want && !stop) {
      try {
        stop = await serveMcp(MCP_PORT, (request) => handleHttp(request, tools, INSTRUCTIONS))
      } catch (e) {
        error.value = e.message // the choice is kept: next start tries again
        return
      }
    } else if (!want && stop) {
      await stop()
      stop = null
    }
    on.value = want
    remember(want)
  }

  onMounted(() => { if (isTauri && remembered()) setOn(true) })
  onBeforeUnmount(() => stop?.())

  return { on, error, setOn, tools }
}
