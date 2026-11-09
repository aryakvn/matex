import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions, slotEditorOptions } from '../src/editor/extensions.js'

const make = (options, md) => new Editor({ ...options, element: document.createElement('div'), content: md })
const table = `| Key    | Page        |
| ------ | ----------- |
| MU-21  | 01 Home     |
| MU-54  | 12 Inspection |`

// A paste event as the browser sends it; `shift` = Ctrl+Shift+V.
function paste(editor, text, { html = '', shift = false } = {}) {
  const view = editor.view
  view.dom.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyV', ctrlKey: true, shiftKey: shift, bubbles: true }))
  const data = { getData: (type) => (type === 'text/plain' ? text : type === 'text/html' ? html : ''), files: [], types: html ? ['text/plain', 'text/html'] : ['text/plain'] }
  const event = new Event('paste', { bubbles: true, cancelable: true })
  event.clipboardData = data
  view.dom.dispatchEvent(event)
}

describe('paste', () => {
  it('reads plain text as Markdown on Ctrl+V', () => {
    const editor = make(editorOptions, 'Before')
    editor.commands.focus('end')
    paste(editor, table)
    const blocks = editor.getJSON().content[0].content
    expect(blocks.map((b) => b.type)).toContain('table')
    expect(editor.getJSON().content).toHaveLength(1) // joins the section, no new one
    expect(editor.getText()).toContain('MU-54')
    editor.destroy()
  })

  it('keeps inline Markdown inside the paragraph', () => {
    const editor = make(editorOptions, 'Hello ')
    editor.commands.focus('end')
    paste(editor, 'big **world**')
    expect(editor.getMarkdown()).toBe('Hello big **world**')
    editor.destroy()
  })

  it('reads code-editor HTML (spans only) as Markdown, formatted HTML as HTML', () => {
    const editor = make(editorOptions, '')
    editor.commands.focus('end')
    paste(editor, '# Title', { html: '<div><span style="color:red"># Title</span></div>' })
    expect(editor.getJSON().content[0].content[0].type).toBe('heading')
    editor.commands.setContent('')
    editor.commands.focus('end')
    paste(editor, '# Title', { html: '<p><b># Title</b></p>' })
    expect(editor.getJSON().content[0].content[0].type).toBe('paragraph')
    editor.destroy()
  })

  it('pastes plain text untouched on Ctrl+Shift+V', () => {
    const editor = make(editorOptions, '')
    editor.commands.focus('end')
    paste(editor, '**not bold**', { shift: true })
    expect(editor.getText().trim()).toBe('**not bold**')
    expect(editor.getJSON().content[0].content[0].content[0].marks).toBeUndefined()
    editor.destroy()
  })

  it('works in header/footer editors', () => {
    const editor = make(slotEditorOptions, '')
    editor.commands.focus('end')
    paste(editor, 'page *one*')
    expect(editor.getMarkdown()).toBe('page *one*')
    editor.destroy()
  })
})
