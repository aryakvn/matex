import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions, slotEditorOptions } from '../src/editor/extensions.js'
import { noteEntries, noteDir, pageAt } from '../src/editor/notes.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const roundTrip = (md) => make(md).getMarkdown()
const fromJSON = (content) =>
  new Editor({ ...editorOptions, contentType: 'json', element: document.createElement('div'), content: { type: 'doc', content } })
const note = (kind, id, text) => ({ type: 'note', attrs: { kind, id, text } })
const para = (...content) => ({ type: 'paragraph', content })
const text = (t) => ({ type: 'text', text: t })

const md = `Body with a footnote[^1] and a source[^ref-1], cited again[^ref-1].

[REFERENCES]

Second[^2] and another source[^ref-2].

[^1]: First *note*.

[^2]: Second note.

[^ref-1]: Smith, *A Book*, 1990.

[^ref-2]: Jones.`

describe('footnotes and references', () => {
  it('round-trips markers, definitions and the references list', () => {
    expect(roundTrip(md).trim()).toBe(md)
    expect(roundTrip(roundTrip(md)).trim()).toBe(md)
  })

  it('reads definitions into the markers and numbers each kind in order of first use', () => {
    const editor = make(md)
    expect(editor.getJSON().content[0].content.map((n) => n.type)).toEqual(['paragraph', 'referenceList', 'paragraph'])
    const list = noteEntries(editor.state.doc).map(({ kind, number, text }) => [kind, number, text])
    expect(list).toEqual([
      ['footnote', 1, 'First *note*.'],
      ['reference', 1, 'Smith, *A Book*, 1990.'],
      ['footnote', 2, 'Second note.'],
      ['reference', 2, 'Jones.'],
    ])
  })

  it('renumbers on save in document order, whatever the ids in memory', () => {
    const editor = fromJSON([
      para(text('A'), note('reference', 'rb', 'B'), text(' C'), note('footnote', 'fx', 'X'), note('reference', 'ra', 'A'), note('reference', 'rb', 'B')),
    ])
    expect(editor.getMarkdown().trim()).toBe('A[^ref-1] C[^1][^ref-2][^ref-1]\n\n[^1]: X\n\n[^ref-1]: B\n\n[^ref-2]: A')
  })

  it('saves a note written over several lines as one line', () => {
    const editor = fromJSON([para(text('A'), note('footnote', 'f', 'one\n\ntwo'))])
    expect(editor.getMarkdown()).toContain('[^1]: one two')
  })

  it('a marker without a definition opens with empty text', () => {
    const editor = make('A[^9]')
    expect(noteEntries(editor.state.doc)).toMatchObject([{ kind: 'footnote', text: '' }])
  })

  it('setNoteText changes every marker of that note', () => {
    const editor = make('A[^ref-1] B[^ref-1]\n\n[^ref-1]: old')
    const { id } = noteEntries(editor.state.doc)[0]
    editor.commands.setNoteText(id, 'new')
    expect(editor.getMarkdown()).toContain('[^ref-1]: new')
    expect(editor.getMarkdown()).not.toContain('old')
  })

  it('numbers the markers on screen', () => {
    const editor = make('A[^1] B[^ref-1]\n\n[^1]: x\n\n[^ref-1]: y')
    const sups = [...editor.view.dom.querySelectorAll('sup.note')]
    expect(sups.map((s) => [s.dataset.kind, s.dataset.n])).toEqual([['footnote', '1'], ['reference', '1']])
  })

  it('literal note and list syntax in a paragraph stays text', () => {
    const editor = fromJSON([para(text('[^1]: not a note')), para(text('[REFERENCES]'))])
    const back = make(editor.getMarkdown()).getJSON().content[0].content
    expect(back.map((n) => n.type)).toEqual(['paragraph', 'paragraph'])
    expect(back.map((n) => n.content[0].text)).toEqual(['[^1]: not a note', '[REFERENCES]'])
  })

  it('header and footer slots have no notes', () => {
    const slot = new Editor({ ...slotEditorOptions, element: document.createElement('div'), content: 'A[^1]' })
    expect(slot.schema.nodes.note).toBeUndefined()
    expect(slot.getMarkdown()).toContain('A')
  })
})

describe('pageAt', () => {
  it('a marker is on the page of the last break at or before it', () => {
    const breaks = [{ pos: 10 }, { pos: 41 }]
    expect(pageAt(breaks, 9)).toBe(1) // last character before the break stays
    expect(pageAt(breaks, 10)).toBe(2)
    expect(pageAt(breaks, 41)).toBe(3)
  })
})

describe('noteDir', () => {
  it('follows the first letter, skipping Markdown and digits', () => {
    expect(noteDir('*کتاب* 1990')).toBe('rtl')
    expect(noteDir('1990. Smith, *کتاب*')).toBe('ltr')
    expect(noteDir('')).toBe('ltr')
  })
})
