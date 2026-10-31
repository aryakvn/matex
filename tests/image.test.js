import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { editorOptions } from '../src/editor/extensions.js'
import { parseImageAttrs, imageAttrBlock, filterCss } from '../src/editor/image.js'

const make = (md) => new Editor({ ...editorOptions, element: document.createElement('div'), content: md })
const imageOf = (editor) => {
  let found
  editor.state.doc.descendants((n) => { if (n.type.name === 'image') found ??= n })
  return found
}

describe('image settings', () => {
  it('round-trip, unknown items kept', () => {
    const md = '![a](assets/a.png "t"){width=50% .center .sepia brightness=120% contrast=80% .flip-h .flip-v #keep}'
    expect(make(md).getMarkdown()).toBe(md)
  })

  it('plain image unchanged; caption still attaches', () => {
    expect(make('![a](x.png)').getMarkdown()).toBe('![a](x.png)')
    const md = '![a](x.png){.right}\n\n: fig-1: cap {#IMG-1}'
    expect(make(md).getMarkdown()).toBe(md)
  })

  it('parses into attrs and draws them', () => {
    const editor = make('![a](x.png){width=140% .grayscale .flip-h}')
    expect(imageOf(editor).attrs).toMatchObject({ width: 100, filter: 'grayscale', flipH: true, align: null })
    const img = editor.view.dom.querySelector('img')
    expect(img.style.width).toBe('100%')
    expect(img.style.filter).toBe('grayscale(1)')
    expect(img.classList.contains('flip-h')).toBe(true)
  })

  it('updated attrs are saved', () => {
    const editor = make('![a](x.png)')
    editor.commands.setNodeSelection(0)
    editor.commands.updateAttributes('image', { width: 30, align: 'center', brightness: 90 })
    expect(editor.getMarkdown()).toBe('![a](x.png){width=30% .center brightness=90%}')
  })

  it('wrap round-trips and floats its caption at the image width', () => {
    const md = '![a](x.png){width=40% .right .wrap}\n\n: fig-1: cap {#IMG-1}\n\nText beside.'
    const editor = make(md)
    expect(editor.getMarkdown()).toBe(md)
    expect(imageOf(editor).attrs.wrap).toBe(true)
    const caption = editor.view.dom.querySelector('.caption')
    expect(caption.classList.contains('wrap-caption')).toBe(true)
    expect(caption.classList.contains('align-right')).toBe(true)
    expect(caption.style.width).toBe('40%')
    expect(make('![a](x.png){.center}\n\n: fig-1: cap {#IMG-1}').view.dom.querySelector('.wrap-caption')).toBe(null)
  })

  it('helpers', () => {
    expect(parseImageAttrs(' .left  width=5% ')).toEqual({ align: 'left', width: 5 })
    expect(imageAttrBlock({ brightness: 100, contrast: 100 })).toBe('')
    expect(filterCss({ filter: 'invert', contrast: 50 })).toBe('invert(1) contrast(50%)')
  })
})
