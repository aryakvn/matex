import { describe, it, expect } from 'vitest'
import { createAssetStore, rotatedName } from '../src/utils/assets.js'

const blob = (...bytes) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })

describe('asset store', () => {
  it('add gives unique safe names', async () => {
    const store = createAssetStore()
    const a = store.add(blob(1), 'My Fig.PNG')
    const b = store.add(blob(2), 'My Fig.PNG')
    const { files } = await store.collect(`![](${a}) ![](${b})`)
    expect(Object.keys(files).sort()).toEqual(['assets/my-fig-2.png', 'assets/my-fig.png'])
  })

  it('collect stores only referenced assets', async () => {
    const store = createAssetStore()
    const a = store.add(blob(1), 'a.png')
    store.add(blob(2), 'b.png')
    const { markdown, files } = await store.collect(`![x](${a})`)
    expect(markdown).toBe('![x](assets/a.png)')
    expect(Object.keys(files)).toEqual(['assets/a.png'])
  })

  it('load then collect round-trips', async () => {
    const store = createAssetStore()
    const original = '![a](assets/a.png) see assets/a.png <img src="assets/a.png">'
    const loaded = store.load(original, { 'assets/a.png': new Uint8Array([7, 8]) })
    expect(loaded).toMatch(/^!\[a\]\(blob:/)
    expect(loaded).toContain(' see assets/a.png ')
    expect(loaded).toMatch(/src="blob:/)
    const { markdown, files } = await store.collect(loaded)
    expect(markdown).toBe(original)
    expect([...files['assets/a.png']]).toEqual([7, 8])
  })

  it('keeps loaded assets referenced in forms it does not rewrite', async () => {
    const store = createAssetStore()
    const md = '![a](./assets/a.png)\n\n[r]: assets/b.png'
    const loaded = store.load(md, { 'assets/a.png': new Uint8Array([1]), 'assets/b.png': new Uint8Array([2]) })
    expect(loaded).toMatch(/!\[a\]\(blob:/)
    const { files } = await store.collect(loaded)
    expect(Object.keys(files).sort()).toEqual(['assets/a.png', 'assets/b.png'])
  })
})

describe('rotatedName', () => {
  it('keeps JPEG and WebP, turns the rest into PNG', () => {
    expect(rotatedName('photo.JPG', 1)).toEqual({ name: 'photo-rot90.jpg', type: 'image/jpeg' })
    expect(rotatedName('a.webp', 3)).toEqual({ name: 'a-rot270.webp', type: 'image/webp' })
    expect(rotatedName('logo.svg', 2)).toEqual({ name: 'logo-rot180.png', type: 'image/png' })
    expect(rotatedName('', 1).name).toBe('image-rot90.png')
  })
})
