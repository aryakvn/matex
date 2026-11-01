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
    const back = make(md).getJSON().content[0].content.filter((n) => n.content)
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

describe('code blocks', () => {
  it('colour code by its fence language and keep the fence on save', () => {
    const md = '```js\nconst x = 1 // note\n```'
    const editor = make(md)
    const spans = [...editor.view.dom.querySelectorAll('pre span[class^="hljs-"]')].map((s) => s.className)
    expect(spans).toEqual(expect.arrayContaining(['hljs-keyword', 'hljs-number', 'hljs-comment']))
    expect(editor.getMarkdown().trim()).toBe(md)
  })
})

describe('manual direction', () => {
  const RLM = String.fromCharCode(0x200f)
  const LRM = String.fromCharCode(0x200e)

  it('saves a forced direction as a leading mark and reads it back', () => {
    const md = `${RLM}hello\n\n## ${LRM}سلام {.unlisted}\n\n- ${RLM}item\n\nplain`
    const editor = make(md)
    const dirs = []
    editor.state.doc.descendants((n) => { if (n.isTextblock) dirs.push([n.textContent, n.attrs.dir]) })
    expect(dirs).toEqual([['hello', 'rtl'], ['سلام', 'ltr'], ['item', 'rtl'], ['plain', 'auto']])
    expect(editor.getMarkdown().trim()).toBe(md)
  })

  it('gives a list item its first paragraph\'s direction, so the bullet moves side too', () => {
    const items = (editor) => [...editor.view.dom.querySelectorAll('li')].map((li) => li.getAttribute('dir'))
    const editor = make(`- ${RLM}one\n- two`)
    expect(items(editor)).toEqual(['rtl', 'rtl']) // the rest of the list follows the first item
    editor.commands.setTextSelection(editor.state.doc.content.size - 2) // in "two"
    editor.commands.toggleDirection('ltr')
    expect(items(editor)).toEqual(['rtl', 'ltr'])
    editor.commands.toggleDirection('ltr')
    expect(items(editor)).toEqual(['rtl', 'rtl'])
    expect(editor.getMarkdown().trim()).toBe(`- ${RLM}one\n- two`)
  })

  it('toggles: same button twice goes back to auto', () => {
    const editor = make('hello')
    editor.commands.toggleDirection('rtl')
    expect(editor.getMarkdown()).toBe(`${RLM}hello`)
    editor.commands.toggleDirection('ltr')
    expect(editor.getMarkdown()).toBe(`${LRM}hello`)
    editor.commands.toggleDirection('ltr')
    expect(editor.getMarkdown()).toBe('hello')
  })

  it('keeps the direction of empty paragraphs and block-like text', () => {
    const json = { type: 'doc', content: [
      { type: 'paragraph', attrs: { dir: 'rtl' }, content: [{ type: 'text', text: '# x' }] },
      { type: 'paragraph', attrs: { dir: 'rtl' } },
      { type: 'paragraph', attrs: { dir: 'rtl' } },
      { type: 'paragraph', content: [{ type: 'text', text: 'end' }] },
    ] }
    const editor = new Editor({ ...editorOptions, element: document.createElement('div'), content: json, contentType: 'json' })
    const reopened = make(editor.getMarkdown()).getJSON().content[0].content
    expect(reopened.map((n) => [n.type, n.attrs.dir, n.content?.[0]?.text])).toEqual([
      ['paragraph', 'rtl', '# x'], ['paragraph', 'rtl', undefined], ['paragraph', 'rtl', undefined], ['paragraph', 'auto', 'end'],
    ])
  })
})

describe('manual direction in tables', () => {
  it('keeps a forced direction inside a table cell', () => {
    const editor = make('| A | B |\n| --- | --- |\n| x | y |')
    let cell
    editor.state.doc.descendants((n, pos) => { if (n.textContent === 'y' && n.type.name === 'paragraph') cell = pos })
    editor.commands.setTextSelection(cell + 1)
    editor.commands.toggleDirection('rtl')
    const md = editor.getMarkdown()
    const reopened = make(md)
    const dirs = []
    reopened.state.doc.descendants((n) => { if (n.type.name === 'paragraph' && n.textContent) dirs.push([n.textContent, n.attrs.dir]) })
    expect(dirs).toEqual([['A', 'auto'], ['B', 'auto'], ['x', 'auto'], ['y', 'rtl']])
    expect(reopened.getMarkdown()).toBe(md)
  })
})

describe('list direction', () => {
  const dirs = (editor) => [...editor.view.dom.querySelectorAll('ul, li, li > p')].map((el) => el.getAttribute('dir'))

  it('follows the first item, not dir="auto" (which skips the items and stays LTR)', () => {
    expect(dirs(make('- سلام\n- hello'))).toEqual(['rtl', 'rtl', 'rtl', 'rtl', 'rtl'])
    expect(dirs(make('- hello\n- سلام'))).toEqual(['ltr', 'ltr', 'ltr', 'ltr', 'ltr'])
  })

  it('takes a forced direction on the first item; a forced later item keeps its own', () => {
    const editor = make('- hello\n- world')
    editor.commands.setTextSelection(3)
    editor.commands.toggleDirection('rtl')
    expect(dirs(editor)).toEqual(['rtl', 'rtl', 'rtl', 'rtl', 'rtl'])
    editor.commands.setTextSelection(editor.state.doc.content.size - 3)
    editor.commands.toggleDirection('ltr')
    expect(dirs(editor)).toEqual(['rtl', 'rtl', 'rtl', 'ltr', 'ltr'])
  })
})

describe('Mermaid charts', () => {
  it('reads a mermaid fence as a chart and saves it back verbatim', () => {
    const md = 'Before\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nAfter'
    expect(make(md).getJSON().content[0].content.map((n) => n.type)).toEqual(['paragraph', 'mermaid', 'paragraph'])
    expect(roundTrip(md)).toBe(md)
  })

  it('leaves other fences as code blocks', () => {
    expect(make('```js\nlet x\n```').getJSON().content[0].content[0].type).toBe('codeBlock')
  })
})
