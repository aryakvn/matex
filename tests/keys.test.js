import { describe, it, expect } from 'vitest'
import { fileAction, zoomKey } from '../src/utils/keys.js'

const ev = (key, code, mods = {}) => ({ key, code, ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, ...mods })

describe('fileAction', () => {
  it('maps Ctrl+S/Shift+S/O/N', () => {
    expect(fileAction(ev('s', 'KeyS'))).toBe('save')
    expect(fileAction(ev('S', 'KeyS', { shiftKey: true }))).toBe('saveAs')
    expect(fileAction(ev('o', 'KeyO'))).toBe('open')
    expect(fileAction(ev('n', 'KeyN', { ctrlKey: false, metaKey: true }))).toBe('new')
  })

  it('works on the Persian keyboard layout', () => {
    expect(fileAction(ev('س', 'KeyS'))).toBe('save')
    expect(fileAction(ev('خ', 'KeyO'))).toBe('open')
  })

  it('ignores other keys and missing modifiers', () => {
    expect(fileAction(ev('b', 'KeyB'))).toBe(null)
    expect(fileAction(ev('s', 'KeyS', { ctrlKey: false }))).toBe(null)
    expect(fileAction(ev('n', 'KeyN', { shiftKey: true }))).toBe(null)
  })
})

describe('zoomKey', () => {
  it('maps Ctrl + = - 0 on the main row and numpad', () => {
    expect(zoomKey(ev('=', 'Equal'))).toBe(1)
    expect(zoomKey(ev('+', 'Equal', { shiftKey: true }))).toBe(1)
    expect(zoomKey(ev('-', 'NumpadSubtract'))).toBe(-1)
    expect(zoomKey(ev('۰', 'Digit0'))).toBe(0)
    expect(zoomKey(ev('=', 'Equal', { ctrlKey: false }))).toBe(null)
    expect(zoomKey(ev('s', 'KeyS'))).toBe(null)
  })
})
