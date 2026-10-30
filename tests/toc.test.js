import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions } from '../src/editor/extensions.js'
import { tocEntries, pageAt } from '../src/editor/toc.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const roundTrip = (md) => make(md).getMarkdown()

const md = `[TOC]

# One

## Hidden {.unlisted}

### Three`

describe('table of contents', () => {
  it('round-trips [TOC] and {.unlisted}', () => {
    expect(roundTrip(md).trim()).toBe(md)
    expect(roundTrip(roundTrip(md)).trim()).toBe(md)
  })

  it('lists every heading with its level and unlisted flag', () => {
    const editor = make(md)
    expect(editor.getJSON().content[0].type).toBe('tableOfContents')
    expect(tocEntries(editor.state.doc).map(({ level, text, unlisted }) => [level, text, unlisted])).toEqual([
      [1, 'One', false],
      [2, 'Hidden', true],
      [3, 'Three', false],
    ])
  })

  it('excluding a heading saves the marker', () => {
    const editor = make('# A')
    editor.view.dispatch(editor.state.tr.setNodeAttribute(0, 'unlisted', true))
    expect(editor.getMarkdown().trim()).toBe('# A {.unlisted}')
  })

  it('literal "[TOC]" and "{.unlisted}" text stays text', () => {
    const json = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '[TOC]' }] },
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Use {.unlisted}' }] },
      ],
    }
    const out = new Editor({ ...editorOptions, contentType: 'json', element: document.createElement('div'), content: json }).getMarkdown()
    const back = make(out).getJSON().content
    expect(back[0]).toMatchObject({ type: 'paragraph', content: [{ text: '[TOC]' }] })
    expect(back[1]).toMatchObject({ type: 'heading', attrs: { unlisted: false }, content: [{ text: 'Use {.unlisted}' }] })
  })
})

describe('pageAt', () => {
  const mm = (n) => (n * 96) / 25.4
  it('counts A4 sheets after the 20mm top padding', () => {
    expect(pageAt(0)).toBe(1)
    expect(pageAt(mm(276))).toBe(1)
    expect(pageAt(mm(278))).toBe(2)
    expect(pageAt(mm(277 + 297) + 1)).toBe(3)
  })
})
