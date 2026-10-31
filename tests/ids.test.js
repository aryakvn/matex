import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { editorOptions } from '../src/editor/extensions.js'
import { pinSelection } from '../src/editor/ids.js'
import { scopeCss } from '../src/utils/styles.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const roundTrip = (md) => make(md).getMarkdown().trim()
const ids = (editor, sel) => [...editor.view.dom.querySelectorAll(sel)].map((el) => el.id)

describe('saved ids', () => {
  it('round-trips block ids, spans and {#id .unlisted}', () => {
    const md = `## Title {#top .unlisted}

Intro text {#intro}

A [few words]{#w} here.

- item {#li}`
    expect(roundTrip(md)).toBe(md)
    const json = make(md).getJSON().content[0].content
    expect(json[0].attrs).toMatchObject({ id: 'top', unlisted: true })
    expect(json[1].attrs.id).toBe('intro')
    expect(json[2].content[1]).toMatchObject({ text: 'few words', marks: [{ type: 'span', attrs: { id: 'w' } }] })
    expect(json[3].content[0].content[0].attrs.id).toBe('li')
  })

  it('literal attribute text stays text', () => {
    const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'see {#x}' }] }] }
    const out = new Editor({ ...editorOptions, contentType: 'json', element: document.createElement('div'), content: json }).getMarkdown()
    expect(make(out).getJSON().content[0].content[0]).toMatchObject({ attrs: { id: null }, content: [{ text: 'see {#x}' }] })
  })

  it('pressing Enter does not copy the id', () => {
    const editor = make('Intro {#intro}')
    editor.commands.setTextSelection(4)
    editor.commands.splitBlock()
    expect(editor.getJSON().content[0].content.map((n) => n.attrs.id)).toEqual(['intro', null])
  })
})

describe('element ids and classes', () => {
  it('gives every element a class and a unique id', () => {
    const editor = make('# سلام\n\nOne {#one}\n\nTwo **bold** متن\n\nOne {#one}')
    const h = editor.view.dom.querySelector('h1')
    expect([...h.classList]).toEqual(expect.arrayContaining(['heading', 'heading-1', 'persian']))
    expect(h.id).toBe('heading-1-1')
    expect(ids(editor, 'p')).toEqual(['one', 'paragraph-2', 'paragraph-3']) // the copy of #one loses it
    expect(ids(editor, 'span.persian')).toEqual(['persian-1', 'persian-2'])
    expect(editor.view.dom.querySelector('strong').className).toBe('bold')
  })
})

describe('pinSelection', () => {
  it('wraps part of a paragraph in a span and saves it', () => {
    const editor = make('Hello world')
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 8, 13)))
    const [id] = pinSelection(editor)
    expect(id).toMatch(/^span-[a-z]+$/)
    expect(editor.getMarkdown().trim()).toBe(`Hello [world]{#${id}}`)
    expect(pinSelection(editor)).toEqual([id]) // same words again: same span
  })

  it('gives whole paragraphs a saved id', () => {
    const editor = make('One\n\nTwo')
    editor.commands.selectAll()
    const got = pinSelection(editor)
    expect(got).toHaveLength(2)
    expect(editor.getMarkdown().trim()).toBe(`One {#${got[0]}}\n\nTwo {#${got[1]}}`)
    expect(ids(editor, 'p')).toEqual(got)
  })
})

describe('scopeCss', () => {
  it('keeps rules inside the page', () => {
    const out = scopeCss('.page .heading-1 { color: red; } } body { display: none; }')
    expect(out.startsWith('.page {')).toBe(true)
    expect(out).toContain('& .heading-1')
    expect(out).toContain('body')
    expect(out.trim().endsWith('}')).toBe(true)
    expect(scopeCss('  ')).toBe('')
  })
})

describe('HTML blocks', () => {
  it('keeps block HTML verbatim between Markdown', () => {
    const md = 'Before\n\n<div align="center">\n<b>x</b> {#no}\n</div>\n\nAfter'
    const editor = make(md)
    expect(editor.getJSON().content[0].content.map((n) => n.type)).toEqual(['paragraph', 'htmlBlock', 'paragraph'])
    expect(roundTrip(md)).toBe(md)
  })

  it('saves it without blank lines, which would end it', () => {
    const editor = make('x')
    editor.commands.setContent({ type: 'doc', content: [{ type: 'htmlBlock', attrs: { html: '<div>\n\n<b>a</b>\n</div>' } }] })
    const md = editor.getMarkdown()
    expect(md.trim()).toBe('<div>\n<b>a</b>\n</div>')
    // (the empty paragraph after it is StarterKit's trailing node)
    expect(make(md).getJSON().content[0].content[0]).toMatchObject({ type: 'htmlBlock', attrs: { html: '<div>\n<b>a</b>\n</div>' } })
  })

  it('draws it sanitized: no scripts, handlers or style', () => {
    const editor = make('<div><img src="x" onerror="alert(1)"><script>alert(2)</script><style>p{}</style><i>ok</i></div>')
    const html = editor.view.dom.querySelector('.html-block').innerHTML
    expect(html).toContain('<i>ok</i>')
    expect(html).not.toMatch(/onerror|script|style/)
  })
})
