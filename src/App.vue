<script setup>
import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useEditor, Editor, EditorContent } from '@tiptap/vue-3'
import { editorOptions, slotEditorOptions } from './editor/extensions.js'
import { slotHtml, isDynamic } from './editor/slots.js'
import { runScript } from './utils/scripts.js'
import { showCode, fieldContent } from './editor/fields.js'
import EditorToolbar from './components/EditorToolbar.vue'
import PageSetup from './components/PageSetup.vue'
import SidePanel from './components/SidePanel.vue'
import ScriptReference from './components/ScriptReference.vue'
import StylesPanel from './components/StylesPanel.vue'
import NoteField from './components/NoteField.vue'
import CssPanel from './components/CssPanel.vue'
import HelpPanel from './components/HelpPanel.vue'
import ToolbarMenu from './components/ToolbarMenu.vue'
import { Ellipsis, Minus, Plus } from 'lucide-vue-next'
import { pinSelection } from './editor/ids.js'
import { pinSection } from './editor/sections.js'
import { clampWidth } from './editor/image.js'
import { noteEntries, noteHtml, noteDir, pageAt } from './editor/notes.js'
import { normalizeStyles, stylesCss, scopeCss } from './utils/styles.js'
import { fillTokens, slotNumber, ALIGNS, sheetSize } from './utils/layout.js'
import { useDocument } from './composables/useDocument.js'
import { onCloseRequest } from './utils/platform.js'
import { fileAction, zoomKey } from './utils/keys.js'

const images = (list) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

// Pasted and dropped images become assets of the document, in whichever editor got them.
const imageProps = (target) => ({
  handlePaste(view, event) {
    const files = images(event.clipboardData?.files)
    if (!files.length) return false
    files.forEach((f) => doc.insertImage(f, undefined, target()))
    return true
  },
  handleDrop(view, event, slice, moved) {
    const files = moved ? [] : images(event.dataTransfer?.files)
    if (!files.length) return false
    const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
    files.forEach((f) => doc.insertImage(f, pos, target()))
    return true
  },
})

const editor = useEditor({
  ...editorOptions,
  content: '',
  autofocus: true,
  editorProps: imageProps(() => editor.value),
})

// Sheets drawn behind the text; the Pagination extension says how many.
const pages = ref(1)
const breaks = shallowRef([])
watch(editor, (e) => e?.on('paginate', (found) => {
  pages.value = found.pages
  breaks.value = found.breaks
}))

// Status bar: the page the cursor is on, and the word count. Tiptap's state is reactive; `doc` keeps
// its identity across selection-only changes, so words are recounted only when the text changes.
// ponytail: recounts the whole text per edit; fine for a book, go incremental if typing lags.
const caretPage = computed(() => (editor.value ? Math.min(pageAt(breaks.value, editor.value.state.selection.head), pages.value) : 1))
const bodyDoc = computed(() => editor.value?.state.doc)
const words = computed(() => bodyDoc.value?.textBetween(0, bodyDoc.value.content.size, ' ', ' ').match(/\S+/g)?.length ?? 0)

// Footnotes and references (editor/notes.js), in order of first use. Footnotes are drawn at the
// bottom of the sheet their marker is on and edited there; any marker (or references entry) clicked
// opens a popup under it with the note's text.
const notes = shallowRef([])
const editingNote = ref(null) // id of the footnote being edited at its sheet's bottom
const popup = ref(null) // { id, pos (null from the references list), left, top }
const focusedNote = shallowRef(null) // a note's editor, while it has the toolbar
watch(editor, (e) => {
  if (!e) return
  const list = () => { notes.value = noteEntries(e.state.doc) }
  list()
  e.on('notes', list)
  e.on('noteClick', openPopup)
})
const footnotes = computed(() => notes.value.filter((n) => n.kind === 'footnote'))
const sheetNotes = computed(() => {
  const per = Array.from({ length: pages.value }, () => [])
  for (const n of footnotes.value) per[Math.min(pageAt(breaks.value, n.pos), pages.value) - 1].push(n)
  return per
})
const popupNote = computed(() => popup.value && notes.value.find((n) => n.id === popup.value.id))

function openPopup({ id, pos = null, el }) {
  if (!el?.getBoundingClientRect) return
  closeNotes()
  const page = pageEl.value.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const z = zoom.value
  popup.value = { id, pos, left: Math.max(0, Math.min((r.left - page.left) / z, page.width / z - 340)), top: (r.bottom - page.top) / z + 6 }
}
function editFootnote(id) {
  if (editingNote.value === id) return
  closeNotes()
  editingNote.value = id
}
function closeNotes() {
  popup.value = null
  editingNote.value = null
  focusedNote.value = null
}
// Enter, Esc or Done: back to the text, just after the marker.
function finishNote(pos) {
  closeNotes()
  const e = editor.value
  if (pos != null && e.state.doc.nodeAt(pos)?.type.name === 'note') e.chain().focus().setTextSelection(pos + 1).run()
  else e.commands.focus()
}
function deleteNote() {
  const { id, pos } = popup.value
  closeNotes()
  const e = editor.value
  if (e.state.doc.nodeAt(pos)?.attrs.id === id) e.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run()
}
// From the toolbar: a new footnote is written at its sheet's bottom, a new reference in its popup;
// citing a known reference again just adds the marker.
function insertNote({ kind, id }) {
  const e = editor.value
  const known = id && notes.value.find((n) => n.id === id)
  const attrs = { kind, id: id ?? `${kind[0]}${Math.random().toString(36).slice(2, 10)}`, text: known?.text ?? '' }
  const pos = e.state.selection.from
  e.chain().focus().insertNote(attrs).run()
  if (known) return
  if (kind === 'footnote') editFootnote(attrs.id)
  else nextTick(() => openPopup({ id: attrs.id, pos, el: e.view.nodeDOM(pos) }))
}

const doc = useDocument(editor)
const { name, dirty, layout, scriptsOn } = doc

const setup = ref(null)
const fileActions = { new: doc.newDoc, open: doc.openDoc, save: doc.save, saveAs: doc.saveAs, pageSetup: () => setup.value.open(), print: () => window.print() }

// Paper size for print, paragraph styles (fonts, sizes), then the document's own CSS (CSS panel), as
// a stylesheet over document.css; it prints too.
const stylesSheet = document.head.appendChild(document.createElement('style'))
const sheet = computed(() => sheetSize(layout))
const css = computed(() =>
  `@page { size: ${sheet.value.width}mm ${sheet.value.height}mm; }\n${stylesCss(normalizeStyles(layout.styles))}\n${scopeCss(layout.css)}`)
watch(css, (text) => { stylesSheet.textContent = text }, { immediate: true })
onBeforeUnmount(() => stylesSheet.remove())

// A section's background is the paper of its sheets, margins included: read off each section (app.css
// hides it there except under .bg-read) and painted on every sheet from the one the section starts on.
const sheetBg = shallowRef([]) // per sheet: background style, or null for plain white
function paintSheets() {
  const e = editor.value
  const page = pageEl.value
  if (!e || !page) return
  const tops = [...page.querySelectorAll(':scope > .sheet')].map((s) => s.getBoundingClientRect().top)
  const starts = [] // [sheet index, style] per section
  page.classList.add('bg-read')
  e.state.doc.forEach((node, pos) => {
    const el = e.view.nodeDOM(pos)
    if (!el?.getBoundingClientRect) return
    const top = el.getBoundingClientRect().top
    const s = getComputedStyle(el)
    // Zero alpha only: rgba(…, 0) or color(… / 0); rgb(0, 128, 0) is green.
    const none = s.backgroundImage === 'none' && /^transparent$|^rgba\(.*, 0\)$|\/ 0\)$/.test(s.backgroundColor)
    starts.push([Math.max(0, tops.findLastIndex((t) => t <= top)), none ? null : {
      backgroundColor: s.backgroundColor,
      backgroundImage: s.backgroundImage,
      backgroundSize: s.backgroundSize,
      backgroundPosition: s.backgroundPosition,
      backgroundRepeat: s.backgroundRepeat,
    }])
  })
  page.classList.remove('bg-read')
  sheetBg.value = tops.map((_, k) => starts.findLast(([n]) => n <= k)?.[1] ?? null)
}
watch([css, pages, breaks], () => nextTick(paintSheets))

// Paper, margins (header and footer heights are the top and bottom ones), the column gap and styles
// all change where lines fall, so they re-flow the pages.
watch(
  () => [layout.headerHeight, layout.footerHeight, layout.marginLeft, layout.marginRight, layout.columnGap, css.value],
  () => nextTick(() => editor.value?.storage.pagination.refresh?.()),
)
// Each slot is Markdown. Per sheet: {{ }} scripts run (if allowed), {page}/{pages} fill in, the page
// number joins its slot. Slots with none of that render once and are shared by every sheet.
const scriptVars = (n) => ({
  page: n,
  pages: pages.value,
  number: layout.number.start + n - 1,
  title: name.value.replace(/\.matex$/i, ''),
  date: new Date(),
})
const fillFor = (n) => (text) => fillTokens(layout, text, n, pages.value)
// A script field's text on sheet n: its result, or its code while scripts are off.
const runFor = (n) => (code) => (scriptsOn.value ? runScript(code, scriptVars(n), layout.script) : showCode(code))
// Fields in the body (editor/fields.js) show their value on the sheet they are on; it changes with
// the breaks, the document script and the rest of scriptVars, not only with the doc.
const sheetAt = (pos) => Math.min(pageAt(breaks.value, pos), pages.value)
watch(editor, (e) => { if (e) e.storage.field.text = (code, pos) => runFor(sheetAt(pos))(code) }, { immediate: true })
watch([scriptsOn, () => layout.script, () => layout.number.start, name, breaks, pages], () => editor.value?.commands.refreshFields())
// [{ header: [html × 3] | null, footer }] per sheet; null = nothing in that zone.
const sheetZones = computed(() => {
  const shared = new Map()
  const once = (md) => (shared.has(md) ? shared : shared.set(md, slotHtml(md))).get(md)
  return Array.from({ length: pages.value }, (_, k) => {
    const n = k + 1
    const out = {}
    for (const z of ['header', 'footer']) {
      const html = layout[z].map((md, i) => {
        const number = slotNumber(layout, z, i, n, pages.value)
        return number || isDynamic(md) ? slotHtml(md, fillFor(n), number, runFor(n)) : once(md)
      })
      out[z] = html.some(Boolean) ? html : null
    }
    return out
  })
})

// Word-style editing in place: double-click a sheet's top or bottom margin to edit that zone (the
// same content on every sheet) in three rich editors; the toolbar works on the focused one. The
// body dims and ignores clicks until a double-click on it or Esc.
// Hit-testing is by coordinates, because on sheets 2+ the margins are covered by page-break spacers.
const pageEl = ref(null)
const editing = ref(null) // { zone: 'header'|'footer', n } or null
const slotEditors = shallowRef([])
const focusedSlot = shallowRef(null)
const activeEditor = computed(() => focusedSlot.value ?? focusedNote.value ?? editor.value)

function slotEditor(zone, i) {
  const ed = new Editor({
    ...slotEditorOptions,
    content: layout[zone][i],
    editorProps: imageProps(() => ed),
    onUpdate: () => { layout[zone][i] = ed.getMarkdown() },
    onFocus: () => { focusedSlot.value = ed },
  })
  return ed
}

// Destroyed after the editors' EditorContent has unmounted.
function dropSlotEditors() {
  const old = slotEditors.value
  slotEditors.value = []
  focusedSlot.value = null
  nextTick(() => old.forEach((ed) => ed.destroy()))
}

function zoneAt(e) {
  const pad = getComputedStyle(pageEl.value)
  const sheets = [...pageEl.value.querySelectorAll(':scope > .sheet')]
  for (const [i, sheet] of sheets.entries()) {
    const r = sheet.getBoundingClientRect()
    if (e.clientY < r.top || e.clientY > r.bottom) continue
    const zone = e.clientY < r.top + parseFloat(pad.paddingTop) * zoom.value ? 'header'
      : e.clientY > r.bottom - parseFloat(pad.paddingBottom) * zoom.value ? 'footer' : null
    const slot = Math.max(0, Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3)))
    return zone && { zone, n: i + 1, slot }
  }
  return null
}

// Capture phase, so it runs before ProseMirror selects a word on the double-click.
function onPageMouseDown(e) {
  if (e.target.closest('.note-pop, .fn-area, .sel-actions')) return
  if (popup.value || editingNote.value) closeNotes()
  if (editing.value && e.target.closest('.sheet-edit')) return
  const hit = zoneAt(e)
  if (!editing.value && !(hit && e.detail >= 2)) return
  e.preventDefault()
  e.stopPropagation()
  if (e.detail < 2) return
  if (hit) startEditing(hit)
  else stopEditing()
}

async function startEditing({ zone, n, slot }) {
  if (editing.value?.zone !== zone) {
    dropSlotEditors()
    slotEditors.value = [0, 1, 2].map((i) => slotEditor(zone, i))
  }
  editing.value = { zone, n }
  await nextTick()
  focusedSlot.value = slotEditors.value[slot] // not only onFocus: a background window gets no focus event
  focusedSlot.value.commands.focus('end')
}

function stopEditing() {
  editing.value = null
  dropSlotEditors()
  editor.value?.commands.focus()
}

// Right-hand side panel: one at a time, by name; the toolbar button toggles it.
const PANELS = { styles: 'Styles', scripts: 'Header & footer scripts', css: 'CSS', help: 'Help' }
const panel = ref(null) // closed until asked for
const panelHelp = ref(false) // the panel's help text is showing
const togglePanel = (key) => (panel.value = panel.value === key ? null : key)
// The ? on the Header/Footer tag: the scripts panel, opened on its help.
function openScriptHelp() {
  panel.value = 'scripts'
  panelHelp.value = true
}
// Help menu: the Help panel, scrolled to the chosen topic.
const helpPanel = ref(null)
async function openHelp(topic) {
  panel.value = 'help'
  await nextTick()
  helpPanel.value?.show(topic)
}
// The scripts panel's Insert: at the cursor of the focused editor (text, header/footer or note).
function insertScript(code) {
  activeEditor.value?.chain().focus().insertContent(fieldContent(code)).run()
}

// A "…" button over the end of a selection in the body; its menu sends the selection's id to the
// CSS panel. Out of the text flow, like everything screen-only in the page.
const selMenu = ref(null) // { left, top } or null
const cssPanel = ref(null)
watch(editor, (e) => e?.on('selectionUpdate', () => {
  const { empty, to } = e.state.selection
  if (empty) return (selMenu.value = null)
  const page = pageEl.value.getBoundingClientRect()
  const at = e.view.coordsAtPos(to)
  const z = zoom.value
  selMenu.value = { left: Math.min((at.right - page.left) / z + 4, page.width / z - 32), top: (at.top - page.top) / z - 30 }
}))
async function styleSelection() {
  const ids = pinSelection(editor.value)
  if (!ids.length) return
  panel.value = 'css'
  await nextTick()
  cssPanel.value?.addRule(ids.map((id) => `#${id}`).join(', '))
}
const selItems = [{ label: 'Style in CSS', run: styleSelection }]
// Toolbar's Layout menu: a rule for the cursor's section (given a saved id first).
async function styleSection() {
  const id = pinSection(editor.value)
  if (!id) return
  panel.value = 'css'
  await nextTick()
  cssPanel.value?.addRule(`#${id}`)
}

// Handles on the selected image's bottom corners (body only). Dragging one draws Word's dashed
// outline and sets the width on release, as a share of the text column (editor/image.js). The image
// itself isn't resized live: ProseMirror would redraw it from the document on every change.
const imgBox = ref(null) // { left, top, width, height } of the selected image, in page coordinates
const ghost = ref(null) // the outline while dragging, same shape
function selectedImage() {
  const sel = editor.value?.state.selection
  return sel?.node?.type.name === 'image' ? editor.value.view.nodeDOM(sel.from) : null
}
function placeImageBox() {
  const img = selectedImage()
  if (!img?.getBoundingClientRect || editing.value) return (imgBox.value = null)
  if (!img.complete) img.addEventListener('load', placeImageBox, { once: true }) // a new src (rotate) has no size yet
  const page = pageEl.value.getBoundingClientRect()
  const r = img.getBoundingClientRect()
  const z = zoom.value
  imgBox.value = { left: (r.left - page.left) / z, top: (r.top - page.top) / z, width: r.width / z, height: r.height / z }
}
watch(editor, (e) => {
  e?.on('transaction', () => nextTick(placeImageBox))
  e?.on('paginate', placeImageBox)
})
watch(editing, () => nextTick(placeImageBox))
// What an image's width percentage is of: its parent's content box, or one column of it.
function columnWidth(el) {
  const s = getComputedStyle(el)
  const inner = el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)
  const n = parseInt(s.columnCount) || 1
  return (inner - (n - 1) * (parseFloat(s.columnGap) || 0)) / n
}
// side: -1 = bottom-left handle, 1 = bottom-right. A centred image grows on both sides at once.
function startResize(down, side) {
  const img = selectedImage()
  const box = imgBox.value
  if (!img || !box?.width) return
  down.preventDefault()
  const e = editor.value
  const pos = e.state.selection.from
  const full = columnWidth(img.parentElement)
  const centred = e.state.doc.nodeAt(pos).attrs.align === 'center'
  let pct = null
  const move = (m) => {
    pct = clampWidth(((box.width + ((m.clientX - down.clientX) / zoom.value) * side * (centred ? 2 : 1)) / full) * 100)
    const width = (pct / 100) * full
    const left = centred ? box.left + (box.width - width) / 2 : side > 0 ? box.left : box.left + box.width - width
    ghost.value = { left, top: box.top, width, height: (width * box.height) / box.width }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    ghost.value = null
    if (pct != null) e.chain().focus().setNodeSelection(pos).updateAttributes('image', { width: pct }).run()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

// The side panel sits under the sticky toolbar, whose height changes as the command bar wraps.
let chromeResize
onMounted(() => {
  chromeResize = new ResizeObserver(([entry]) =>
    document.documentElement.style.setProperty('--chrome-h', `${entry.target.offsetHeight}px`))
  const bar = document.querySelector('.toolbar')
  if (bar) chromeResize.observe(bar)
})
onBeforeUnmount(() => chromeResize?.disconnect())

// Zoom, as in Word: the status bar's slider, Ctrl + = / - / 0 and Ctrl + wheel over the pages.
// The page is scaled with a transform, so lines and page breaks stay exactly as printed; positions
// read off the screen inside the page are divided by it. `.zoom-box` takes up the scaled size.
const ZOOM_MIN = 0.25
const ZOOM_MAX = 3
const zoom = ref(1)
const setZoom = (z) => { zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100)) }
// One step = the next multiple of 10%, so odd values from the slider land back on the grid.
const stepZoom = (dir) => setZoom((Math.round(zoom.value * 10) + dir) / 10)
function onWheel(e) {
  if (!(e.ctrlKey || e.metaKey)) return
  e.preventDefault()
  stepZoom(e.deltaY < 0 ? 1 : -1)
}
watch(zoom, () => nextTick(() => {
  closeNotes()
  selMenu.value = null
  placeImageBox()
}))

function onKey(e) {
  const step = zoomKey(e)
  if (step != null) {
    e.preventDefault()
    return step ? stepZoom(step) : setZoom(1)
  }
  const action = fileAction(e)
  if (!action) return
  e.preventDefault()
  fileActions[action]()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  onCloseRequest(() => dirty.value)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <EditorToolbar
    :editor="activeEditor" :name="name" :dirty="dirty" :panel="panel"
    @file="fileActions[$event]()" @image="doc.insertImage($event, undefined, activeEditor)" @panel="togglePanel" @note="insertNote" @section-css="styleSection" @rotate="doc.rotateImage($event, activeEditor)" @help="openHelp"
  />
  <div class="workspace">
  <main class="desk" @wheel="onWheel">
    <div
      class="zoom-box"
      :style="{
        '--zoom': zoom,
        '--box-w': `${sheet.width}mm`,
        '--box-h': `calc(${pages} * (${sheet.height}mm + var(--page-gap)) - var(--page-gap))`,
      }"
    >
    <article
      ref="pageEl"
      :class="['page', { 'hf-mode': editing }]"
      :style="{
        '--sheet-w': `${sheet.width}mm`,
        '--sheet-h': `${sheet.height}mm`,
        '--margin-top': `${layout.headerHeight}mm`,
        '--margin-bottom': `${layout.footerHeight}mm`,
        '--margin-left': `${layout.marginLeft}mm`,
        '--margin-right': `${layout.marginRight}mm`,
        '--column-gap': `${layout.columnGap}mm`,
        '--header-size': `${layout.headerSize}pt`,
        '--footer-size': `${layout.footerSize}pt`,
        minHeight: `calc(${pages} * (var(--sheet-h) + var(--page-gap)) - var(--page-gap))`,
      }"
      @mousedown.capture="onPageMouseDown"
    >
      <div v-for="n in pages" :id="`sheet-${n}`" :key="n" class="sheet" :style="[{ top: `calc(${n - 1} * (var(--sheet-h) + var(--page-gap)))` }, sheetBg[n - 1]]">
        <template v-for="z in ['header', 'footer']" :key="z">
          <div v-if="sheetZones[n - 1]?.[z]" :id="`${z}-${n}`" :class="['hf', `hf-${z}`]">
            <div
              v-for="(html, i) in sheetZones[n - 1][z]" :id="`${z}-${n}-${ALIGNS[i]}`" :key="i"
              :class="['hf-slot', `slot-${ALIGNS[i]}`]" dir="auto" :style="{ textAlign: ALIGNS[i] }" v-html="html"
            />
          </div>
        </template>
      </div>
      <template v-for="(list, k) in sheetNotes" :key="`fn${k}`">
        <ol
          v-if="list.length" :id="`footnotes-${k + 1}`" class="fn-area" :dir="noteDir(list[0].text)"
          :style="{ top: `calc(${k + 1} * (var(--sheet-h) + var(--page-gap)) - var(--page-gap) - var(--margin-bottom))` }"
        >
          <li v-for="n in list" :id="`footnote-text-${n.number}`" :key="n.id" class="fn-item" :dir="noteDir(n.text)" @click="editFootnote(n.id)">
            <span class="fn-num">{{ n.number }}</span>
            <NoteField
              v-if="editingNote === n.id" :body="editor" :id="n.id" :text="n.text"
              @focus="focusedNote = $event" @done="finishNote(n.pos)"
            />
            <span v-else class="fn-text" v-html="noteHtml(editor, n.text, runFor(sheetAt(n.pos))) || '&nbsp;'" />
          </li>
        </ol>
      </template>
      <!-- Every footnote at full width, unseen: pagination.js reads their heights from here. -->
      <ol v-if="footnotes.length" class="fn-area fn-measure" dir="auto" aria-hidden="true">
        <li v-for="n in footnotes" :key="n.id" :data-note="n.id" class="fn-item" :dir="noteDir(n.text)">
          <span class="fn-num">{{ n.number }}</span>
          <span class="fn-text" v-html="noteHtml(editor, n.text, runFor(sheetAt(n.pos))) || '&nbsp;'" />
        </li>
      </ol>
      <div v-if="popupNote" class="note-pop" :style="{ left: `${popup.left}px`, top: `${popup.top}px` }">
        <span class="note-pop-title">{{ popupNote.kind === 'reference' ? `Reference [${popupNote.number}]` : `Footnote ${popupNote.number}` }}</span>
        <NoteField :key="popup.id" :body="editor" :id="popup.id" :text="popupNote.text" @focus="focusedNote = $event" @done="finishNote(popup.pos)" />
        <div class="note-pop-actions">
          <button v-if="popup.pos != null" type="button" class="pop-btn" @click="deleteNote">Delete</button>
          <button type="button" class="pop-btn primary" @click="finishNote(popup.pos)">Done</button>
        </div>
      </div>
      <div v-if="selMenu && !editing" class="sel-actions" :style="{ left: `${selMenu.left}px`, top: `${selMenu.top}px` }">
        <ToolbarMenu label="Selection actions" :items="selItems" :chevron="false">
          <Ellipsis :size="16" aria-hidden="true" />
        </ToolbarMenu>
      </div>
      <template v-if="imgBox">
        <span
          v-for="side in [-1, 1]" :key="side" :class="['img-handle', side > 0 ? 'img-handle-r' : 'img-handle-l']"
          :style="{ left: `${imgBox.left + (side > 0 ? imgBox.width : 0)}px`, top: `${imgBox.top + imgBox.height}px` }"
          title="Drag to resize" aria-hidden="true" @pointerdown="startResize($event, side)"
        />
      </template>
      <div v-if="ghost" class="img-ghost" :style="{ left: `${ghost.left}px`, top: `${ghost.top}px`, width: `${ghost.width}px`, height: `${ghost.height}px` }" />
      <div
        v-if="editing"
        class="sheet-edit"
        :style="{ top: `calc(${Math.min(editing.n, pages) - 1} * (var(--sheet-h) + var(--page-gap)))` }"
        @keydown.esc="stopEditing"
      >
        <div :class="['hf', `hf-${editing.zone}`, 'hf-edit']">
          <span class="hf-tag">
            {{ editing.zone }}
            <button type="button" class="hf-help" title="Header and footer help" aria-label="Header and footer help" @click="openScriptHelp">?</button>
          </span>
          <div v-for="(ed, i) in slotEditors" :key="i" class="hf-slot" :style="{ textAlign: ALIGNS[i] }">
            <EditorContent :editor="ed" :aria-label="`${editing.zone} ${ALIGNS[i]}`" />
            <span v-if="slotNumber(layout, editing.zone, i, editing.n, pages)" class="hf-number">
              {{ slotNumber(layout, editing.zone, i, editing.n, pages) }}
            </span>
          </div>
        </div>
      </div>
      <EditorContent :editor="editor" />
    </article>
    </div>
  </main>
  <SidePanel v-model:show-help="panelHelp" :open="!!panel" :title="PANELS[panel] ?? ''" :help="panel !== 'help'" @update:open="panel = null">
    <template #default="{ showHelp }">
      <StylesPanel v-if="panel === 'styles'" :editor="activeEditor" :styles="layout.styles" :show-help="showHelp" />
      <ScriptReference
        v-if="panel === 'scripts'" v-model:script="layout.script"
        :vars="scriptVars(editing?.n ?? caretPage)" :scripts-on="scriptsOn" :show-help="showHelp"
        @insert="insertScript"
      />
      <CssPanel v-if="panel === 'css'" ref="cssPanel" v-model="layout.css" :show-help="showHelp" />
      <HelpPanel v-if="panel === 'help'" ref="helpPanel" />
    </template>
  </SidePanel>
  </div>
  <footer class="statusbar">
    <span>Page {{ caretPage }} of {{ pages }}</span>
    <span>{{ words.toLocaleString('en') }} {{ words === 1 ? 'word' : 'words' }}</span>
    <div class="zoom" role="group" aria-label="Zoom">
      <button type="button" class="zoom-btn" title="Zoom out (Ctrl+-)" aria-label="Zoom out" :disabled="zoom <= ZOOM_MIN" @click="stepZoom(-1)">
        <Minus :size="14" aria-hidden="true" />
      </button>
      <input
        type="range" class="zoom-slider" :min="ZOOM_MIN * 100" :max="ZOOM_MAX * 100" step="5" aria-label="Zoom level"
        :value="Math.round(zoom * 100)" @input="setZoom($event.target.value / 100)"
      >
      <button type="button" class="zoom-btn" title="Zoom in (Ctrl+=)" aria-label="Zoom in" :disabled="zoom >= ZOOM_MAX" @click="stepZoom(1)">
        <Plus :size="14" aria-hidden="true" />
      </button>
      <button type="button" class="zoom-btn zoom-pct" title="Reset to 100% (Ctrl+0)" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button>
    </div>
  </footer>
  <PageSetup ref="setup" :layout="layout" />
</template>
