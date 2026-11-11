import { describe, it, expect, vi, afterEach } from 'vitest'
import { createApp, h, reactive, ref, shallowRef } from 'vue'
import { Editor } from '@tiptap/core'
import { editorOptions } from '../src/editor/extensions.js'
import { createAssetStore } from '../src/utils/assets.js'
import { allowed, answer, handleHttp } from '../src/utils/mcp.js'

vi.mock('../src/utils/platform.js', () => ({ isTauri: false, ask: vi.fn(async () => false), serveMcp: vi.fn() }))
const { ask } = await import('../src/utils/platform.js')
const { useMcp } = await import('../src/composables/useMcp.js')

const post = (message, extra = {}) =>
  handleHttp({ method: 'POST', url: '/mcp', host: '127.0.0.1:7420', origin: null, body: JSON.stringify(message), ...extra }, [], '')

describe('MCP protocol', () => {
  it('lets only a local agent in', () => {
    expect(allowed('127.0.0.1:7420', null)).toBe(true)
    expect(allowed('localhost:7420', 'http://localhost:6274')).toBe(true)
    expect(allowed('evil.example:7420', null)).toBe(false) // DNS rebinding
    expect(allowed('127.0.0.1:7420', 'https://evil.example')).toBe(false) // a web page
    expect(allowed('127.0.0.1:7420', 'null')).toBe(false)
    expect(allowed('', null)).toBe(false)
  })

  it('answers over HTTP', async () => {
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' })).status).toBe(200)
    expect(await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).toEqual({ status: 202, body: '' })
    expect((await post({}, { host: 'evil.example:7420' })).status).toBe(403)
    expect((await post({}, { url: '/other' })).status).toBe(404)
    expect((await post({}, { method: 'GET' })).status).toBe(405)
    expect(JSON.parse((await post(null, { body: '{' })).body).error.code).toBe(-32700)
  })

  it('negotiates the version and lists tools', async () => {
    const tools = [{ name: 'hi', description: 'd', inputSchema: { type: 'object' }, run: () => 'hello' }]
    const init = await answer({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, tools)
    expect(init.result.protocolVersion).toBe('2025-06-18')
    expect(init.result.capabilities).toEqual({ tools: {} })
    const later = await answer({ id: 2, method: 'initialize', params: { protocolVersion: '2099-01-01' } }, tools)
    expect(later.result.protocolVersion).toBe('2025-11-25')
    expect((await answer({ id: 3, method: 'tools/list' }, tools)).result.tools).toEqual([{ name: 'hi', description: 'd', inputSchema: { type: 'object' } }])
    expect((await answer({ id: 4, method: 'tools/call', params: { name: 'hi' } }, tools)).result.content[0].text).toBe('hello')
    expect((await answer({ id: 5, method: 'tools/call', params: { name: 'nope' } }, tools)).error.code).toBe(-32602)
    expect((await answer({ id: 6, method: 'what' }, tools)).error.code).toBe(-32601)
  })

  it('reports a failing tool as a tool error', async () => {
    const tools = [{ name: 'bad', run: () => { throw new Error('nope') } }]
    const { result } = await answer({ id: 1, method: 'tools/call', params: { name: 'bad' } }, tools)
    expect(result).toEqual({ content: [{ type: 'text', text: 'nope' }], isError: true })
  })
})

describe('MCP tools', () => {
  let editor, app
  afterEach(() => { app?.unmount(); editor?.destroy() })

  function setup(md) {
    editor = new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
    const assets = createAssetStore()
    const layout = reactive({ css: '' })
    let mcp
    app = createApp({ setup() { mcp = useMcp({ editor: shallowRef(editor), assets, layout, scriptsOn: ref(true) }); return () => h('div') } })
    app.mount(document.createElement('div'))
    const call = (name, args = {}) => mcp.tools.find((t) => t.name === name).run(args)
    return { call, assets, layout }
  }

  it('edits the Markdown in place, undoably', async () => {
    const { call } = setup('# Title\n\nOne **two** three.')
    expect(await call('get_document')).toBe('# Title\n\nOne **two** three.')
    await call('edit_document', { old_text: '**two**', new_text: '*2*' })
    expect(editor.getMarkdown()).toBe('# Title\n\nOne *2* three.')
    editor.commands.undo()
    expect(editor.getMarkdown()).toBe('# Title\n\nOne **two** three.')
  })

  it('refuses a missing, repeated or ill-typed old_text', async () => {
    const { call } = setup('a b a')
    expect(() => call('edit_document', { old_text: 'x', new_text: 'y' })).toThrow(/not in the document/)
    expect(() => call('edit_document', { old_text: 'a', new_text: 'y' })).toThrow(/2 times/)
    expect(() => call('edit_document', { old_text: 1, new_text: 'y' })).toThrow(/must be a string/)
    await call('edit_document', { old_text: 'a', new_text: 'c', replace_all: true })
    expect(editor.getMarkdown()).toBe('c b c')
  })

  it('inserts at the cursor or the end', async () => {
    const { call } = setup('First\n\nLast')
    editor.commands.setTextSelection(1)
    await call('insert_markdown', { markdown: '**Bold** ' })
    await call('insert_markdown', { markdown: '## End\n\nText', at: 'end' })
    expect(editor.getMarkdown()).toBe('**Bold** First\n\nLast\n\n## End\n\nText')
    expect(editor.getJSON().content).toHaveLength(1) // still one section
  })

  it('shows images by asset name', async () => {
    const { call, assets } = setup('')
    const url = assets.add(new Blob(['x']), 'pic.png')
    editor.commands.setContent(`![a](${url})`, { contentType: 'markdown' })
    expect(await call('get_document')).toBe('![a](assets/pic.png)')
    await call('write_document', { markdown: 'New\n\n![b](assets/pic.png)' })
    expect(editor.getMarkdown()).toContain(`![b](${url})`)
  })

  it('asks before adding script fields', async () => {
    const { call } = setup('Page {{ page }}')
    await call('edit_document', { old_text: 'Page', new_text: 'Sheet' }) // known field: no question
    expect(ask).not.toHaveBeenCalled()
    await expect(call('insert_markdown', { markdown: '{{ fetch("x") }}' })).rejects.toThrow(/refused/)
    expect(ask).toHaveBeenCalledOnce()
    expect(editor.getMarkdown()).toBe('Sheet {{ page }}')
  })

  it('reads and writes the CSS', async () => {
    const { call, layout } = setup('')
    expect(await call('get_css')).toBe('(empty)')
    await call('set_css', { css: '.paragraph { color: red }' })
    expect(layout.css).toBe('.paragraph { color: red }')
  })
})
