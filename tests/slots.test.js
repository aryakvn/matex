import { describe, it, expect } from 'vitest'
import { runScripts, hasScripts, EXAMPLES } from '../src/utils/scripts.js'
import { slotHtml as render, isDynamic } from '../src/editor/slots.js'

const slotHtml = (...a) => render(...a).replaceAll(' dir="auto"', '')
import { defaultLayout, fillTokens } from '../src/utils/layout.js'
import { createAssetStore } from '../src/utils/assets.js'

describe('header/footer scripts', () => {
  const vars = { page: 3, pages: 9, number: 3, title: 'Thesis', date: new Date(2026, 0, 2) }

  it('runs expressions and statement bodies, shows errors in place', () => {
    expect(runScripts('p {{ page * 2 }} of {{pages}}', vars)).toBe('p 6 of 9')
    expect(runScripts('{{ if (page % 2) return "odd"; return "even" }}', vars)).toBe('odd')
    expect(runScripts('{{ title.toUpperCase() }}', vars)).toBe('THESIS')
    expect(runScripts('{{ nope() }}', vars)).toMatch(/^⚠ /)
    expect(hasScripts('a {{ b }}')).toBe(true)
    expect(hasScripts('a {page}')).toBe(false)
  })

  it('every example in the side panel runs', () => {
    for (const x of EXAMPLES) expect(runScripts(x.code, vars), x.code).not.toMatch(/⚠|\{\{/)
  })

  it('keeps {page} tokens apart from {{ page }} scripts', () => {
    expect(fillTokens(defaultLayout(), '{page}/{pages} {{page}}', 2, 5)).toBe('2/5 {{page}}')
  })
})

describe('slotHtml', () => {
  it('renders Markdown, fills text and appends the page number', () => {
    expect(slotHtml('**Ch {page}**', (t) => t.replace('{page}', '4'))).toBe('<p class="paragraph"><strong class="bold">Ch 4</strong></p>')
    expect(slotHtml('A', undefined, '7')).toBe('<p class="paragraph">A 7</p>')
    expect(slotHtml('', undefined, '7')).toBe('<p class="paragraph">7</p>')
    expect(slotHtml('')).toBe('')
    expect(slotHtml('![logo](blob:x)')).toContain('<img class="image" src="blob:x"')
    expect(isDynamic('{{ date }}')).toBe(true)
    expect(isDynamic('plain')).toBe(false)
  })
})

describe('asset store with header/footer slots', () => {
  it('loads and collects images across body and slots', async () => {
    const assets = createAssetStore()
    const files = { 'assets/logo.png': new Uint8Array([1]), 'assets/a.png': new Uint8Array([2]) }
    const [body, slot] = assets.load(['![](assets/a.png)', '![](assets/logo.png)'], files)
    expect(slot).toMatch(/^!\[\]\(blob:/)
    const out = await assets.collect([body, slot])
    expect(out.markdown).toEqual(['![](assets/a.png)', '![](assets/logo.png)'])
    expect(Object.keys(out.files).sort()).toEqual(['assets/a.png', 'assets/logo.png'])
  })
})
