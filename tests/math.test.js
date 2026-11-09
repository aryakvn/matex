import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions, slotEditorOptions } from '../src/editor/extensions.js'
import { slotHtml } from '../src/editor/slots.js'

const make = (md, options = editorOptions) => new Editor({ ...options, element: document.createElement('div'), content: md })
const roundTrip = (md) => make(md).getMarkdown().trim()
const types = (editor) => {
  const list = []
  editor.state.doc.descendants((n) => { list.push(n.type.name) })
  return list
}

describe('math', () => {
  it('reads $x$ as an inline equation and saves it back', () => {
    const md = 'Energy $E = mc^2$ and $\\frac{a}{b}$ here.'
    const editor = make(md)
    const found = []
    editor.state.doc.descendants((n) => { if (n.type.name === 'inlineMath') found.push(n.attrs.latex) })
    expect(found).toEqual(['E = mc^2', '\\frac{a}{b}'])
    expect(roundTrip(md)).toBe(md)
  })

  it('reads a $$ block as display math, also over several lines', () => {
    const md = 'Before\n\n$$\n\\int_0^1 x\\,dx\n= \\tfrac12\n$$\n\nAfter'
    const editor = make(md)
    let latex
    editor.state.doc.descendants((n) => { if (n.type.name === 'blockMath') latex = n.attrs.latex })
    expect(latex).toBe('\\int_0^1 x\\,dx\n= \\tfrac12')
    expect(roundTrip(md)).toBe(md)
    expect(roundTrip(roundTrip(md))).toBe(md)
    expect(roundTrip('$$x^2$$')).toBe('$$\nx^2\n$$')
  })

  it('leaves prices and lone dollars as text', () => {
    for (const md of ['It costs $5 and $10.', 'From $5-$10 a day.', 'A $ sign', 'Pay $ 3 $ now']) {
      const editor = make(md)
      expect(types(editor)).not.toContain('inlineMath')
      expect(editor.getText().trim()).toBe(md)
    }
  })

  it('saves text dollars escaped, so they reopen as text', () => {
    const editor = make('x')
    editor.commands.setContent({ type: 'doc', content: [{ type: 'section', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a $b$ c' }] }] }] })
    const md = editor.getMarkdown().trim()
    expect(md).toBe('a \\$b\\$ c')
    const again = make(md)
    expect(types(again)).not.toContain('inlineMath')
    expect(again.getText().trim()).toBe('a $b$ c')
  })

  it('keeps $ in code as is', () => {
    expect(roundTrip('Use `$x$` and\n\n```sh\necho $HOME\n```')).toBe('Use `$x$` and\n\n```sh\necho $HOME\n```')
  })

  it('a $$ mid-line does not split the paragraph', () => {
    const editor = make('one $$ two\n$$\nx\n$$')
    expect(editor.getText()).toContain('one $$ two')
  })

  it('drops an empty inline equation on save; inserts empty ones to edit', () => {
    const editor = make('a')
    editor.commands.setTextSelection(2)
    editor.commands.insertInlineMath()
    expect(types(editor)).toContain('inlineMath')
    expect(editor.getMarkdown().trim()).toBe('a')
    editor.commands.insertBlockMath({ latex: 'y' })
    expect(editor.getMarkdown()).toContain('$$\ny\n$$')
  })

  it('draws KaTeX in rendered HTML (header/footer slots)', () => {
    const html = slotHtml('Page $x^2$')
    expect(html).toContain('class="katex"')
    expect(html).toContain('data-latex="x^2"')
    expect(make('$y$', slotEditorOptions).getMarkdown().trim()).toBe('$y$')
  })

  it('pastes rendered HTML back as an equation', () => {
    const editor = make('a')
    editor.commands.setContent(make('b $z_1$').getHTML(), { contentType: 'html' })
    expect(editor.getMarkdown().trim()).toBe('b $z_1$')
  })
})
