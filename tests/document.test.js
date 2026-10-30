import { describe, it, expect } from 'vitest'
import { shallowRef } from 'vue'
import { Editor } from '@tiptap/core'
import { editorOptions } from '../src/editor/extensions.js'
import { useDocument } from '../src/composables/useDocument.js'

const png = (name) => new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' })

describe('useDocument', () => {
  it('inserting two images in a row keeps both', () => {
    const editor = new Editor({ ...editorOptions, element: document.createElement('div'), content: 'text' })
    const doc = useDocument(shallowRef(editor))
    editor.commands.focus('end')
    doc.insertImage(png('a.png'))
    doc.insertImage(png('b.png'))
    const md = editor.getMarkdown()
    expect(md).toContain('![a.png](blob:')
    expect(md).toContain('![b.png](blob:')
  })
})
