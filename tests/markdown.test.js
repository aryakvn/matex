import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions } from '../src/editor/extensions.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const roundTrip = (md) => make(md).getMarkdown()

const basics = `# H1

## H2

A **bold** *italic* ~~strike~~ \`code\` [link](https://example.com) end.

- a
- b

1. a
2. b

> quote

\`\`\`js
let x = 1
\`\`\`

---

![alt](assets/fig.png)


| A   | B   |
| --- | --- |
| 1   | 2   |`

describe('markdown', () => {
  it('round-trips basics', () => {
    expect(roundTrip(basics).trim()).toBe(basics.trim())
  })

  it('second save changes nothing', () => {
    const once = roundTrip(basics)
    expect(roundTrip(once)).toBe(once)
  })

  it('round-trips nested lists without stray blank lines', () => {
    const md = '- a\n  - b\n- c'
    expect(roundTrip(md).trim()).toBe(md)
    expect(roundTrip(roundTrip(md)).trim()).toBe(md)
  })

  it('indenting a list item gives clean nested markdown', () => {
    const editor = make('- a\n- b')
    editor.commands.focus('end')
    editor.commands.sinkListItem('listItem')
    expect(editor.getMarkdown().trim()).toBe('- a\n  - b')
  })

  it('paragraph text that looks like block syntax stays a paragraph', () => {
    const texts = ['2) paren', '1. x', '- x', '+ x', '* x', '# x', '> q', '---', '    indented']
    const json = { type: 'doc', content: texts.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })) }
    const md = new Editor({ ...editorOptions, contentType: 'json', element: document.createElement('div'), content: json }).getMarkdown()
    const back = make(md).getJSON().content.filter((n) => n.content)
    expect(back.map((n) => n.type)).toEqual(texts.map(() => 'paragraph'))
    expect(back.map((n) => n.content.map((c) => c.text).join(''))).toEqual(texts)
  })

  it('keeps mixed Persian/English text', () => {
    const md = 'سلام MaTex دنیا\n\nHello سلام'
    expect(roundTrip(md).trim()).toBe(md)
  })

  it('sets dir=auto on blocks but not in markdown', () => {
    const editor = make('سلام\n\nHello')
    expect(editor.view.dom.querySelector('p').getAttribute('dir')).toBe('auto')
    expect(editor.getMarkdown()).not.toContain('dir')
  })

  it('does not drop unknown inline html text', () => {
    const out = roundTrip('Text <span class="x">kept</span> end')
    expect(out).toContain('kept')
    expect(out).toContain('end')
  })
})

describe('shortcuts', () => {
  const key = (editor, k) =>
    editor.view.someProp('handleKeyDown', (f) => f(editor.view, new KeyboardEvent('keydown', { key: k, ctrlKey: true, shiftKey: true })))

  it('Ctrl+Shift+S is left for Save as, Ctrl+Shift+X toggles strike', () => {
    const editor = make('word')
    editor.commands.selectAll()
    key(editor, 's')
    expect(editor.isActive('strike')).toBe(false)
    key(editor, 'x')
    expect(editor.isActive('strike')).toBe(true)
  })
})
