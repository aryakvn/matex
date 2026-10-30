// The open document: its name, path, unsaved state, images, and the
// New / Open / Save / Save as commands. Works on a Tiptap editor ref.
import { ref, watch, watchEffect } from 'vue'
import { pack, unpack } from '../utils/archive.js'
import { createAssetStore } from '../utils/assets.js'
import { openFile, saveFile, ask, showError, setTitle } from '../utils/platform.js'

const UNTITLED = 'Untitled.matex'
const DISCARD = 'Discard unsaved changes?'

export function useDocument(editor) {
  const name = ref(UNTITLED)
  const path = ref(null)
  const dirty = ref(false)
  const assets = createAssetStore()

  watch(editor, (e) => e?.on('update', () => (dirty.value = true)), { immediate: true })
  watchEffect(() => setTitle(`${dirty.value ? '• ' : ''}${name.value} — MaTex`))

  async function okToDiscard() {
    return !dirty.value || ask(DISCARD)
  }

  function show(markdown, file) {
    editor.value.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false })
    editor.value.commands.focus('start')
    name.value = file.name
    path.value = file.path
    dirty.value = false
  }

  async function newDoc() {
    if (!(await okToDiscard())) return
    assets.clear()
    show('', { name: UNTITLED, path: null })
  }

  async function openDoc() {
    if (!(await okToDiscard())) return
    try {
      const file = await openFile()
      if (!file) return
      const { markdown, files } = unpack(file.bytes) // throws before anything changes
      show(assets.load(markdown, files), file)
    } catch (err) {
      showError(`Could not open the file. ${err.message}`)
    }
  }

  async function write(saveAs) {
    try {
      const { markdown, files } = await assets.collect(editor.value.getMarkdown())
      const fileName = name.value.endsWith('.matex') ? name.value : `${name.value}.matex`
      const saved = await saveFile(pack({ markdown, files }), { path: path.value, name: fileName, saveAs })
      if (!saved) return
      name.value = saved.name
      path.value = saved.path
      dirty.value = false
    } catch (err) {
      showError(`Could not save. Your changes are still here. ${err.message}`)
    }
  }

  // pos: where to insert (e.g. the drop point). Default is the end of the selection,
  // so a just-inserted (still selected) image is never replaced by the next one.
  function insertImage(file, pos) {
    const src = assets.add(file, file.name)
    const at = pos ?? editor.value.state.selection.to
    editor.value.chain().focus().insertContentAt(at, { type: 'image', attrs: { src, alt: file.name } }).run()
  }

  return { name, dirty, newDoc, openDoc, save: () => write(false), saveAs: () => write(true), insertImage }
}
