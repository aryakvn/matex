// The open document: its name, path, unsaved state, images, and the
// New / Open / Save / Save as commands. Works on a Tiptap editor ref.
import { ref, reactive, watch, watchEffect } from 'vue'
import { EditorState } from '@tiptap/pm/state'
import { pack, unpack } from '../utils/archive.js'
import { createAssetStore, rotateImage, rotatedName } from '../utils/assets.js'
import { defaultLayout, normalizeLayout } from '../utils/layout.js'
import { hasScripts } from '../utils/scripts.js'
import { openFile, saveFile, ask, showError, setTitle } from '../utils/platform.js'

const UNTITLED = 'Untitled.matex'
const DISCARD = 'Discard unsaved changes?'
const RUN_SCRIPTS =
  'This document has scripts ({{ }}) in its header or footer. Scripts can do anything this app can, ' +
  'including reading and writing your files. Run them only if you trust where the document came from.\n\nRun the scripts?'

export function useDocument(editor) {
  const name = ref(UNTITLED)
  const path = ref(null)
  const dirty = ref(false)
  const assets = createAssetStore()
  const layout = reactive(defaultLayout()) // headers, footers, page numbers; edited by the page setup dialog
  // Whether {{ }} scripts run. Yes for your own documents; asked for each opened one that has any.
  const scriptsOn = ref(true)

  watch(editor, (e) => e?.on('update', () => (dirty.value = true)), { immediate: true })
  watch(layout, () => (dirty.value = true), { deep: true, flush: 'sync' }) // sync: show() resets dirty right after loading
  watchEffect(() => setTitle(`${dirty.value ? '• ' : ''}${name.value} — MaTex`))

  async function okToDiscard() {
    return !dirty.value || ask(DISCARD)
  }

  function show(markdown, file, saved = null) {
    Object.assign(layout, normalizeLayout(saved))
    const e = editor.value
    e.commands.setContent(markdown, { contentType: 'markdown', emitUpdate: false })
    // Fresh state = empty undo history, so Ctrl+Z can't bring back the previous document.
    e.view.updateState(EditorState.create({ doc: e.state.doc, plugins: e.state.plugins }))
    e.commands.focus('start')
    name.value = file.name
    path.value = file.path
    dirty.value = false
  }

  async function newDoc() {
    if (!(await okToDiscard())) return
    assets.clear()
    scriptsOn.value = true
    show('', { name: UNTITLED, path: null })
  }

  async function openDoc() {
    if (!(await okToDiscard())) return
    try {
      const file = await openFile()
      if (!file) return
      const { markdown, files, layout: saved } = unpack(file.bytes) // throws before anything changes
      const lay = normalizeLayout(saved)
      const [body, ...slots] = assets.load([markdown, ...lay.header, ...lay.footer], files)
      Object.assign(lay, { header: slots.slice(0, 3), footer: slots.slice(3) })
      const risky = slots.some(hasScripts)
      scriptsOn.value = !risky // off until answered, so nothing runs behind the question
      show(body, file, lay)
      if (risky) scriptsOn.value = await ask(RUN_SCRIPTS)
    } catch (err) {
      showError(`Could not open the file. ${err.message}`)
    }
  }

  async function write(saveAs) {
    try {
      const { markdown: [markdown, ...slots], files } = await assets.collect([editor.value.getMarkdown(), ...layout.header, ...layout.footer])
      const savedLayout = { ...JSON.parse(JSON.stringify(layout)), header: slots.slice(0, 3), footer: slots.slice(3) }
      const fileName = name.value.endsWith('.matex') ? name.value : `${name.value}.matex`
      const saved = await saveFile(pack({ markdown, files, layout: savedLayout }), { path: path.value, name: fileName, saveAs })
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
  // target: the editor to insert into (a header/footer slot); default is the body.
  function insertImage(file, pos, target = editor.value) {
    const src = assets.add(file, file.name)
    const at = pos ?? target.state.selection.to
    target.chain().focus().insertContentAt(at, { type: 'image', attrs: { src, alt: file.name } }).run()
  }

  // Rotate the selected image a quarter turn (1 clockwise, -1 counter-clockwise) by redrawing its pixels
  // into a new asset, so it takes the right room on the page and shows turned in any Markdown viewer.
  // Every turn is drawn from the original image, so turning again doesn't re-compress a JPEG, and
  // turning all the way back gives the original file. ponytail: forgotten on reopen (one more encode then).
  const turned = new Map() // rotated blob URL -> { from: original src, turns }
  async function rotate(delta, target = editor.value) {
    const pos = target.state.selection.from
    const node = target.state.doc.nodeAt(pos)
    if (node?.type.name !== 'image') return
    const { src } = node.attrs
    const { from, turns: had } = turned.get(src) ?? { from: src, turns: 0 }
    const turns = (((had + delta) % 4) + 4) % 4
    let next = from
    if (turns) {
      const { name, type } = rotatedName(assets.get(from)?.name ?? 'image.png', turns)
      try {
        next = assets.add(await rotateImage(from, turns, type), name)
      } catch (e) {
        return showError(`Can't rotate this image: ${e.message}`)
      }
      turned.set(next, { from, turns })
    }
    // Drawing takes a moment: the image may have moved meanwhile, so look for it by its src.
    let at = target.state.doc.nodeAt(pos)?.attrs.src === src ? pos : null
    if (at == null) target.state.doc.descendants((n, p) => { if (at == null && n.type.name === 'image' && n.attrs.src === src) at = p })
    if (at != null) target.chain().setNodeSelection(at).updateAttributes('image', { src: next }).run()
  }

  return { name, dirty, layout, scriptsOn, newDoc, openDoc, save: () => write(false), saveAs: () => write(true), insertImage, rotateImage: rotate }
}
