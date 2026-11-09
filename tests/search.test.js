import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions } from '../src/editor/extensions.js'
import { findMatches, searchState, replacementFor } from '../src/editor/search.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const texts = (editor, options) => findMatches(editor.state.doc, options).map((m) => editor.state.doc.textBetween(m.from, m.to))

describe('find and replace', () => {
  it('finds across marks, ignoring case unless asked', () => {
    const e = make('Cat **ca**t\n\ncAT dog')
    expect(texts(e, { query: 'cat' })).toEqual(['Cat', 'cat', 'cAT'])
    expect(texts(e, { query: 'cat', caseSensitive: true })).toEqual(['cat'])
    e.destroy()
  })

  it('matches whole words in Persian too, and folds Arabic ye/kaf', () => {
    const e = make('کتاب کتابخانه كتاب\n\nmy book, mybook')
    expect(texts(e, { query: 'کتاب', wholeWord: true })).toEqual(['کتاب', 'كتاب'])
    expect(texts(e, { query: 'كتاب', caseSensitive: true })).toEqual(['كتاب'])
    expect(texts(e, { query: 'book', wholeWord: true })).toEqual(['book'])
    e.destroy()
  })

  it('never matches across an inline atom', () => {
    const e = make('ab $x$ cd')
    expect(texts(e, { query: 'b  c' })).toEqual([])
    expect(texts(e, { query: '.+', regex: true })).toEqual(['ab ', ' cd'])
    e.destroy()
  })

  it('reports a bad regular expression instead of throwing', () => {
    const e = make('text')
    e.commands.setSearch({ query: '(', regex: true })
    expect(searchState(e.state)).toMatchObject({ matches: [], error: expect.any(String) })
    e.destroy()
  })

  it('expands $1, $& and $$ for regular expressions only', () => {
    const m = /(\d+)-(?<b>\d+)/.exec('12-34')
    expect(replacementFor(m, '$2/$1 [$&] $<b> $$', true)).toBe('34/12 [12-34] 34 $')
    expect(replacementFor(m, '$1', false)).toBe('$1')
  })

  it('steps through matches, wrapping around', () => {
    const e = make('one two one two one')
    e.commands.setSearch({ query: 'one' })
    e.commands.setTextSelection(1)
    const at = () => searchState(e.state).index
    e.commands.findNext()
    expect(at()).toBe(0)
    e.commands.findNext()
    e.commands.findNext()
    expect(at()).toBe(2)
    e.commands.findNext()
    expect(at()).toBe(0)
    e.commands.findNext(true)
    expect(at()).toBe(2)
    e.destroy()
  })

  it('replaces the selected match then selects the next; replace all is one undo', () => {
    const e = make('a cat, a cat, a cat')
    e.commands.setSearch({ query: 'cat' })
    e.commands.replaceNext('dog') // nothing selected yet: only finds
    expect(e.getMarkdown().trim()).toBe('a cat, a cat, a cat')
    e.commands.replaceNext('dog')
    expect(e.getMarkdown().trim()).toBe('a dog, a cat, a cat')
    expect(searchState(e.state)).toMatchObject({ index: 0 })
    expect(searchState(e.state).matches).toHaveLength(2)
    e.commands.replaceAll('cow')
    expect(e.getMarkdown().trim()).toBe('a dog, a cow, a cow')
    e.commands.undo()
    expect(e.getMarkdown().trim()).toBe('a dog, a cat, a cat')
    e.destroy()
  })

  it('replaces with regex groups and keeps the marks of the text', () => {
    const e = make('**2024-05** and 1999-12')
    e.commands.setSearch({ query: String.raw`(\d{4})-(\d\d)`, regex: true })
    e.commands.replaceAll('$2/$1')
    expect(e.getMarkdown().trim()).toBe('**05/2024** and 12/1999')
    e.destroy()
  })
})
