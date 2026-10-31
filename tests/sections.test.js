import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { TextSelection } from '@tiptap/pm/state'
import { editorOptions } from '../src/editor/extensions.js'
import { sectionAt } from '../src/editor/sections.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const sections = (editor) => editor.getJSON().content.map((s) => [s.attrs.id, s.attrs.columns, s.content.map((b) => b.content?.[0]?.text ?? b.type)])

const md = `Intro

::: {#appendix .section columns=2}

## A

Text[^1]

\`\`\`
:::
\`\`\`

:::

::: {.section}

End

:::

[^1]: A note.`

describe('sections', () => {
  it('reads fenced sections and gathers the unfenced start into one', () => {
    expect(sections(make(md))).toEqual([
      [null, 1, ['Intro']],
      ['appendix', 2, ['A', 'Text', ':::']],
      [null, 1, ['End']],
    ])
  })

  it('round-trips, with the first section left unfenced', () => {
    expect(make(md).getMarkdown()).toBe(md)
    expect(make('Just text').getMarkdown()).toBe('Just text')
  })

  it('keeps paragraph text that starts with ::: as text', () => {
    const json = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '::: {.section}' }] }] }
    const out = new Editor({ ...editorOptions, contentType: 'json', element: document.createElement('div'), content: json }).getMarkdown()
    expect(sections(make(out))).toEqual([[null, 1, ['::: {.section}']]])
  })

  it('pastes a copied section into the current one, not as a new section', () => {
    const editor = make('One\n\nTwo')
    editor.commands.selectAll()
    const { dom } = editor.view.serializeForClipboard(editor.state.selection.content())
    editor.commands.focus('end')
    editor.view.pasteHTML(dom.innerHTML, new Event('paste')) // jsdom has no ClipboardEvent
    expect(editor.state.doc.childCount).toBe(1)
  })

  it('splits at the cursor and joins back', () => {
    const editor = make('Hello world')
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 8)))
    editor.commands.setSectionColumns(3)
    editor.commands.insertSection()
    expect(sections(editor)).toEqual([[null, 3, ['Hello ']], [null, 3, ['world']]])
    expect(sectionAt(editor.state).index).toBe(1)
    editor.commands.removeSectionBreak()
    expect(sections(editor)).toEqual([[null, 3, ['Hello ', 'world']]])
  })

  it('adds an empty section after a block that cannot split', () => {
    const editor = make('[TOC]')
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1)))
    editor.commands.insertSection()
    expect(sections(editor)).toEqual([[null, 1, ['tableOfContents']], [null, 1, ['paragraph']]])
  })
})
