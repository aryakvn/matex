import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { editorOptions } from '../src/editor/extensions.js'
import { captionEntries } from '../src/editor/captions.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const shown = (editor) => [...editor.view.dom.querySelectorAll('.media-ref')].map((el) => el.dataset.label)

const md = `![map](assets/map.png)

: fig-1: A map of *Tehran* {#IMG-1}


| a   | b   |
| --- | --- |
| 1   | 2   |


: Table 1: Numbers {#TBL-1}

As [IMG-1] and [TBL-1] show, not [IMG-9].`

describe('captions and references', () => {
  it('round-trips captions and references', () => {
    const editor = make(md)
    const types = editor.getJSON().content[0].content.map((n) => n.type)
    expect(types).toEqual(['image', 'caption', 'table', 'caption', 'paragraph'])
    expect(editor.getMarkdown().trim()).toBe(md)
    expect(make(editor.getMarkdown()).getMarkdown()).toBe(editor.getMarkdown())
  })

  it('shows each reference as its caption label, and follows a rename', () => {
    const editor = make(md)
    expect(captionEntries(editor.state.doc).map((c) => [c.ref, c.label])).toEqual([['IMG-1', 'fig-1'], ['TBL-1', 'Table 1']])
    expect(shown(editor)).toEqual(['fig-1', 'Table 1', '??'])
    const { pos } = captionEntries(editor.state.doc)[0]
    editor.chain().insertContentAt({ from: pos + 1, to: pos + 6 }, 'Figure 7').run()
    expect(shown(editor)).toEqual(['Figure 7', 'Table 1', '??'])
    expect(editor.getMarkdown()).toContain('As [IMG-1] and')
  })

  it('adds a numbered caption under a selected image, once', () => {
    const editor = make('![a](a.png)\n\n: fig-1: First {#IMG-1}\n\n![b](b.png)')
    const first = captionEntries(editor.state.doc)[0].pos
    const imagePos = first + editor.state.doc.nodeAt(first).nodeSize
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos)))
    expect(editor.commands.insertCaption()).toBe(true)
    editor.commands.insertContent('Second')
    expect(editor.getMarkdown()).toContain(': fig-2: Second {#IMG-2}')
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, imagePos)))
    expect(editor.commands.insertCaption()).toBe(false)
  })

  it('captions an equation block as EQ-n and refers to it', () => {
    const editor = make('$$\nx^2\n$$\n\nSee')
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 1)))
    expect(editor.commands.insertCaption()).toBe(true)
    editor.commands.insertContent('Square')
    editor.commands.focus('end')
    editor.commands.insertMediaRef('EQ-1')
    const out = editor.getMarkdown().trim()
    expect(out).toBe('$$\nx^2\n$$\n\n: eq-1: Square {#EQ-1}\n\nSee[EQ-1]')
    expect(make(out).getMarkdown().trim()).toBe(out)
    expect(shown(make(out))).toEqual(['eq-1'])
  })

  it('gives a copied caption a new key', () => {
    const editor = make(': fig-1: A {#IMG-1}\n\n: fig-1: B {#IMG-1}')
    editor.commands.insertContent('x') // any edit
    expect(captionEntries(editor.state.doc).map((c) => c.ref)).toEqual(['IMG-1', 'IMG-2'])
  })

  it('keeps look-alike text out of captions and references', () => {
    const text = 'A line {#IMG-1}\n\n[IMG-1](http://x.y) link'
    expect(make(text).getMarkdown().trim()).toBe('A line \{#IMG-1}\n\n[IMG-1](http://x.y) link')
  })

  it('turns typed [IMG-1] into a reference', () => {
    const editor = make(': fig-1: A {#IMG-1}\n\nSee ')
    editor.commands.focus('end')
    for (const ch of '[IMG-1]') {
      const { from, to } = editor.state.selection
      if (!editor.view.someProp('handleTextInput', (f) => f(editor.view, from, to, ch))) editor.commands.insertContent(ch)
    }
    expect(shown(editor)).toEqual(['fig-1'])
  })
})
