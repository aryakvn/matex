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
