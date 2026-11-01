import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions, slotEditorOptions } from '../src/editor/extensions.js'
import { slotHtml } from '../src/editor/slots.js'
import { noteHtml } from '../src/editor/notes.js'

const make = (md, options = editorOptions) => new Editor({ ...options, element: document.createElement('div'), content: md })
const roundTrip = (md, options) => make(md, options).getMarkdown().trim()
const fields = (editor) => {
  const list = []
  editor.state.doc.descendants((n) => { if (n.type.name === 'field') list.push(n.attrs.code) })
  return list
}
// Types text as if from the keyboard, so input rules run.
function type(editor, text) {
  for (const ch of text) {
    const { from, to } = editor.state.selection
    const handled = editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, ch, () => editor.state.tr.insertText(ch, from, to)))
    if (!handled) editor.view.dispatch(editor.state.tr.insertText(ch, from, to))
  }
}

describe('script fields', () => {
  it('reads {{ }} anywhere inline and saves it back', () => {
    const md = '# Chapter {{ number }}\n\nPage {{ page }} of {{pages}}, **{{ title }}**.\n\n| a | b |\n| --- | --- |\n| {{ 1 + 1 }} | x |'
    const editor = make(md)
    expect(fields(editor)).toEqual(['number', 'page', 'pages', 'title', '1 + 1'])
    expect(editor.getMarkdown()).toContain('Page {{ page }} of {{ pages }}, **{{ title }}**.')
    expect(roundTrip(roundTrip(md))).toBe(roundTrip(md))
  })

  it('keeps escaped and code braces as text, and saves text braces escaped', () => {
    const editor = make('A \\{{ page }} and `{{ x }}`.')
    expect(fields(editor)).toEqual([])
    expect(editor.state.doc.textContent).toBe('A {{ page }} and {{ x }}.')
    expect(editor.getMarkdown().trim()).toBe('A \\{{ page }} and `{{ x }}`.')
    expect(roundTrip('a \\{\\{{ b }}')).toBe('a \\{\\{{ b }}')
  })

  it('turns typed {{ code }} into a field; \\{{ … }} stays literal text', () => {
    const editor = make('')
    editor.commands.focus('end')
    type(editor, 'p {{ page }}')
    expect(fields(editor)).toEqual(['page'])
    type(editor, ' \\{{ no }}')
    expect(fields(editor)).toEqual(['page'])
    expect(editor.state.doc.textContent).toBe('p  {{ no }}')
    expect(editor.getMarkdown().trim()).toBe('p {{ page }} \\{{ no }}')
  })

  it('works in header/footer editors and their rendered HTML', () => {
    expect(roundTrip('Page {{ page }} \\{{ x }}', slotEditorOptions)).toBe('Page {{ page }} \\{{ x }}')
    const html = slotHtml('**{{ page * 2 }}** \\{{ x }} {page}', (t) => t.replace('{page}', 'P'), '', (code) => `<${code}>`)
    expect(html).toContain('<strong class="bold">&lt;page * 2&gt;</strong> {{ x }} P')
    expect(slotHtml('A {{ page }}')).toContain('A {{ page }}') // no runner: the code
  })

  it('fills notes with their values', () => {
    const editor = make('x')
    expect(noteHtml(editor, 'See {{ page }}.', () => '4')).toContain('See 4.')
    expect(noteHtml(editor, 'See {{ page }}.', () => '5')).toContain('See 5.')
    expect(noteHtml(editor, 'See {{ page }}.')).toContain('See {{ page }}.')
  })

  it('drops an empty field on save; values come from storage.field.text', () => {
    const editor = make('a')
    editor.commands.focus('end')
    editor.commands.insertField()
    expect(editor.getMarkdown().trim()).toBe('a')
    editor.storage.field.text = (code, pos) => `${code}@${pos}`
    editor.commands.setContent('a {{ page }}', { contentType: 'markdown' })
    editor.commands.refreshFields()
    const decos = editor.state.plugins.flatMap((p) => p.props.decorations?.call(p, editor.state)?.find() ?? [])
    const deco = decos.find((d) => d.spec.field)
    expect(deco.spec.value).toMatch(/^page@\d+$/)
  })
})
