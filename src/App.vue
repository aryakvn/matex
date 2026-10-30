<script setup>
import { ref, shallowRef, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useEditor, Editor, EditorContent } from '@tiptap/vue-3'
import { editorOptions, slotEditorOptions } from './editor/extensions.js'
import { slotHtml, isDynamic } from './editor/slots.js'
import { runScripts } from './utils/scripts.js'
import EditorToolbar from './components/EditorToolbar.vue'
import PageSetup from './components/PageSetup.vue'
import SidePanel from './components/SidePanel.vue'
import ScriptReference from './components/ScriptReference.vue'
import { fillTokens, slotNumber, ALIGNS } from './utils/layout.js'
import { useDocument } from './composables/useDocument.js'
import { onCloseRequest } from './utils/platform.js'
import { fileAction } from './utils/keys.js'

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

// A4 sheets drawn behind the text; the Pagination extension says how many.
const pages = ref(1)
watch(editor, (e) => e?.on('paginate', (found) => { pages.value = found.pages }))

const doc = useDocument(editor)
const { name, dirty, layout, scriptsOn } = doc

const setup = ref(null)
const fileActions = { new: doc.newDoc, open: doc.openDoc, save: doc.save, saveAs: doc.saveAs, pageSetup: () => setup.value.open() }

// Header and footer heights are the page's top and bottom margins, so changing them re-flows the pages.
watch(() => [layout.headerHeight, layout.footerHeight], () => nextTick(() => editor.value?.storage.pagination.refresh?.()))
// Each slot is Markdown. Per sheet: {{ }} scripts run (if allowed), {page}/{pages} fill in, the page
// number joins its slot. Slots with none of that render once and are shared by every sheet.
const scriptVars = (n) => ({
  page: n,
  pages: pages.value,
  number: layout.number.start + n - 1,
  title: name.value.replace(/\.matex$/i, ''),
  date: new Date(),
})
const fillFor = (n) => (text) =>
  fillTokens(layout, scriptsOn.value ? runScripts(text, scriptVars(n)) : text, n, pages.value)
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
        return number || isDynamic(md) ? slotHtml(md, fillFor(n), number) : once(md)
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
const activeEditor = computed(() => focusedSlot.value ?? editor.value)

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
    const zone = e.clientY < r.top + parseFloat(pad.paddingTop) ? 'header'
      : e.clientY > r.bottom - parseFloat(pad.paddingBottom) ? 'footer' : null
    const slot = Math.max(0, Math.min(2, Math.floor(((e.clientX - r.left) / r.width) * 3)))
    return zone && { zone, n: i + 1, slot }
  }
  return null
}

// Capture phase, so it runs before ProseMirror selects a word on the double-click.
function onPageMouseDown(e) {
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
const PANELS = { scripts: 'Header & footer scripts' }
const panel = ref(null) // closed until asked for
const panelHelp = ref(false) // the panel's help text is showing
const togglePanel = (key) => (panel.value = panel.value === key ? null : key)
// The ? on the Header/Footer tag: the scripts panel, opened on its help.
function openScriptHelp() {
  panel.value = 'scripts'
  panelHelp.value = true
}
function insertScript(code) {
  focusedSlot.value?.chain().focus().insertContent(code).run()
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

function onKey(e) {
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
    @file="fileActions[$event]()" @image="doc.insertImage($event, undefined, activeEditor)" @panel="togglePanel"
  />
  <div :class="['workspace', { 'with-side': panel }]">
  <main class="desk">
    <article
      ref="pageEl"
      :class="['page', { 'hf-mode': editing }]"
      :style="{
        '--margin-top': `${layout.headerHeight}mm`,
        '--margin-bottom': `${layout.footerHeight}mm`,
        '--header-size': `${layout.headerSize}pt`,
        '--footer-size': `${layout.footerSize}pt`,
        minHeight: `calc(${pages} * (297mm + var(--page-gap)) - var(--page-gap))`,
      }"
      @mousedown.capture="onPageMouseDown"
    >
      <div v-for="n in pages" :key="n" class="sheet" :style="{ top: `calc(${n - 1} * (297mm + var(--page-gap)))` }">
        <template v-for="z in ['header', 'footer']" :key="z">
          <div v-if="sheetZones[n - 1]?.[z]" :class="['hf', `hf-${z}`]">
            <div v-for="(html, i) in sheetZones[n - 1][z]" :key="i" class="hf-slot" dir="auto" :style="{ textAlign: ALIGNS[i] }" v-html="html" />
          </div>
        </template>
      </div>
      <div
        v-if="editing"
        class="sheet-edit"
        :style="{ top: `calc(${Math.min(editing.n, pages) - 1} * (297mm + var(--page-gap)))` }"
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
  </main>
  <SidePanel v-model:show-help="panelHelp" :open="!!panel" :title="PANELS[panel] ?? ''" help @update:open="panel = null">
    <template #default="{ showHelp }">
      <ScriptReference
        v-if="panel === 'scripts'"
        :vars="scriptVars(editing?.n ?? 1)" :can-insert="!!focusedSlot" :scripts-on="scriptsOn" :show-help="showHelp"
        @insert="insertScript"
      />
    </template>
  </SidePanel>
  </div>
  <PageSetup ref="setup" :layout="layout" />
</template>
