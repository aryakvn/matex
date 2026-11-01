<script setup>
// Title strip + Fluent-style command bar for a Tiptap editor. Formatting runs straight on the editor;
// file actions and picked images go up as events so the owner decides what they mean.
import { computed, ref, nextTick, watch } from 'vue'
import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Code, Link, List, ListOrdered,
  Quote, Minus, Image, Table, TableOfContents, ChevronDown, PilcrowRight, PilcrowLeft, Braces, FileCode, CodeXml, CaseSensitive, Superscript, Columns2, Captions, Workflow,
  AlignStartVertical, AlignCenterVertical, AlignEndVertical, Contrast, SunDim, FlipHorizontal2, FlipVertical2, TextWrap, RotateCcw, RotateCw,
} from 'lucide-vue-next'
import ToolbarMenu from './ToolbarMenu.vue'
import { HELP_TOPICS } from './HelpPanel.vue'
import { directionAt } from '../editor/direction.js'
import { noteEntries } from '../editor/notes.js'
import { captionEntries } from '../editor/captions.js'
import { sectionAt, MAX_COLUMNS } from '../editor/sections.js'
import { IMAGE_FILTERS, clampWidth } from '../editor/image.js'
import { canWrapColumns } from '../utils/layout.js'
import { STYLES, styleAt, applyStyle } from '../utils/styles.js'
import appIcon from '../../src-tauri/icons/64x64.png'

const props = defineProps({
  editor: { type: Object, default: null },
  name: { type: String, default: '' },
  dirty: { type: Boolean, default: false },
  panel: { type: String, default: null }, // the side panel that is open, if any
})
const emit = defineEmits(['file', 'image', 'panel', 'note', 'sectionCss', 'rotate', 'help'])

const mod = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'
const chain = () => props.editor.chain().focus()

const fileItems = [
  { label: 'New', hint: `${mod}N`, run: () => emit('file', 'new') },
  { label: 'Open…', hint: `${mod}O`, run: () => emit('file', 'open') },
  null,
  { label: 'Save', hint: `${mod}S`, run: () => emit('file', 'save') },
  { label: 'Save as…', hint: `${mod}Shift+S`, run: () => emit('file', 'saveAs') },
  null,
  { label: 'Page setup…', run: () => emit('file', 'pageSetup') },
]

const marks = [
  { name: 'bold', label: 'Bold', icon: Bold, hint: `${mod}B`, run: () => chain().toggleBold().run() },
  { name: 'italic', label: 'Italic', icon: Italic, hint: `${mod}I`, run: () => chain().toggleItalic().run() },
  { name: 'strike', label: 'Strikethrough', icon: Strikethrough, hint: `${mod}Shift+X`, run: () => chain().toggleStrike().run() },
  { name: 'code', label: 'Inline code', icon: Code, hint: `${mod}E`, run: () => chain().toggleCode().run() },
]

const blocks = [
  { name: 'bulletList', label: 'Bulleted list', icon: List, run: () => chain().toggleBulletList().run() },
  { name: 'orderedList', label: 'Numbered list', icon: ListOrdered, run: () => chain().toggleOrderedList().run() },
  { name: 'blockquote', label: 'Quote', icon: Quote, run: () => chain().toggleBlockquote().run() },
]

// Word's ¶ buttons: force a direction on the selected paragraphs; pressing the lit one returns to auto.
const directions = [
  { dir: 'ltr', label: 'Left-to-right text', icon: PilcrowRight },
  { dir: 'rtl', label: 'Right-to-left text', icon: PilcrowLeft },
]

const blockType = computed(() => styleAt(props.editor))

const inTable = computed(() => props.editor?.isActive('table') ?? false)
const tableItems = computed(() => [
  { label: 'Insert table', disabled: inTable.value, run: () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  null,
  { label: 'Add row below', disabled: !inTable.value, run: () => chain().addRowAfter().run() },
  { label: 'Add column right', disabled: !inTable.value, run: () => chain().addColumnAfter().run() },
  { label: 'Delete row', disabled: !inTable.value, run: () => chain().deleteRow().run() },
  { label: 'Delete column', disabled: !inTable.value, run: () => chain().deleteColumn().run() },
  null,
  { label: 'Delete table', disabled: !inTable.value, run: () => chain().deleteTable().run() },
])

// Footnotes and references. App.vue inserts them (and opens where the text is written);
// a reference already in the document can be cited again under the same number.
const excerpt = (md) => md.replace(/[*_`~\\[\]()#>]/g, '').trim().slice(0, 48) || 'Untitled reference'
function noteItems() {
  const refs = noteEntries(props.editor.state.doc).filter((e) => e.kind === 'reference')
  return [
    { label: 'Footnote', run: () => emit('note', { kind: 'footnote' }) },
    { label: 'New reference', run: () => emit('note', { kind: 'reference' }) },
    ...(refs.length ? [null, ...refs.map((r) => ({ label: `Cite [${r.number}] ${excerpt(r.text)}`, run: () => emit('note', { kind: 'reference', id: r.id }) }))] : []),
    null,
    { label: 'References list', run: () => chain().insertReferenceList().run() },
  ]
}

// Captions (captions.js): add one under the selected image/table/HTML block, or refer to one.
function captionItems() {
  const can = props.editor.can().insertCaption()
  const captions = captionEntries(props.editor.state.doc)
  return [
    { label: can ? 'Add caption' : 'Add caption (select an image, chart, table or HTML block)', disabled: !can, run: () => chain().insertCaption().run() },
    ...(captions.length ? [null, ...captions.map((c) => ({ label: `Refer to ${excerpt(c.text) || c.ref}`, hint: `[${c.ref}]`, run: () => chain().insertMediaRef(c.ref).run() }))] : []),
  ]
}

// Sections (sections.js): columns of the cursor's section, section breaks, and its CSS (App.vue opens
// the CSS panel on a rule for the section's id).
function layoutItems() {
  const at = sectionAt(props.editor.state)
  const one = canWrapColumns ? '' : ' (shown as one here)'
  return [
    ...Array.from({ length: MAX_COLUMNS }, (_, i) => ({
      label: i ? `${i + 1} columns${one}` : 'One column',
      checked: at?.node.attrs.columns === i + 1,
      disabled: !at,
      run: () => chain().setSectionColumns(i + 1).run(),
    })),
    null,
    { label: 'Section break (next page)', disabled: !at, run: () => chain().insertSection().run() },
    { label: 'Remove section break', disabled: !at?.index, run: () => chain().removeSectionBreak().run() },
    null,
    { label: 'Style this section in CSS', disabled: !at, run: () => emit('sectionCss') },
  ]
}

// Picture (image.js): shown while an image is selected, like Word's Picture Format tab. Sliders and
// the width field don't take focus back to the text, so they keep working while dragged or typed in.
const pic = computed(() => (props.editor?.isActive('image') ? props.editor.getAttributes('image') : null))
const setPic = (attrs) => props.editor.chain().updateAttributes('image', attrs).run()
const picAligns = [
  { align: 'left', label: 'Align left', icon: AlignStartVertical },
  { align: 'center', label: 'Center', icon: AlignCenterVertical },
  { align: 'right', label: 'Align right', icon: AlignEndVertical },
]
const picDefaults = { width: null, align: null, wrap: false, filter: null, brightness: 100, contrast: 100, flipH: false, flipV: false }
const capitalize = (s) => s[0].toUpperCase() + s.slice(1)
const filterItems = computed(() => [
  ...[null, ...IMAGE_FILTERS].map((f) => ({ label: f ? capitalize(f) : 'No filter', checked: (pic.value?.filter ?? null) === f, run: () => setPic({ filter: f }) })),
  null,
  { label: 'Reset picture', run: () => setPic(picDefaults) },
])
function setWidth(e) {
  const n = parseFloat(e.target.value)
  setPic({ width: Number.isFinite(n) ? clampWidth(n) : null })
  e.target.value = pic.value?.width ?? ''
}
// Wrapping floats the image to its side, so it needs left or right: centring or un-aligning ends it,
// and turning it on picks the paragraph's start side (and a width, if there was none).
const sides = ['left', 'right']
function alignPic(a) {
  const align = pic.value.align === a ? null : a
  setPic({ align, ...(!sides.includes(align) && { wrap: false }) })
}
function toggleWrap() {
  if (pic.value.wrap) return setPic({ wrap: false })
  const el = props.editor.view.nodeDOM(props.editor.state.selection.from)?.parentElement
  const start = el && getComputedStyle(el).direction === 'rtl' ? 'right' : 'left'
  setPic({ wrap: true, align: sides.includes(pic.value.align) ? pic.value.align : start, width: pic.value.width ?? 40 })
}
const adjustOpen = ref(false)
watch(pic, (p) => { if (!p) adjustOpen.value = false })

// Link: small popover, because window.prompt doesn't exist in Tauri webviews.
const linkOpen = ref(false)
const linkUrl = ref('')
const linkInput = ref(null)

async function openLink() {
  linkUrl.value = props.editor.getAttributes('link').href ?? ''
  linkOpen.value = true
  await nextTick()
  linkInput.value?.select()
}
function applyLink() {
  const href = linkUrl.value.trim()
  linkOpen.value = false
  if (!href) return removeLink()
  const { empty } = props.editor.state.selection
  if (empty && !props.editor.isActive('link')) {
    chain().insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run()
  } else {
    chain().extendMarkRange('link').setLink({ href }).run()
  }
}
function removeLink() {
  linkOpen.value = false
  chain().extendMarkRange('link').unsetLink().run()
}

// Edit and Insert menus in the title bar: the ribbon's actions again, as lists. A command the focused
// editor lacks (TOC, notes, sections... in a header/footer slot) is left out, like its ribbon button.
const has = (cmd) => !!props.editor.commands[cmd]
const toggled = (item, on) => ({ label: item.label, hint: item.hint, checked: on, run: item.run })
function editItems() {
  const e = props.editor
  return [
    { label: 'Undo', hint: `${mod}Z`, disabled: !e.can().undo(), run: () => chain().undo().run() },
    { label: 'Redo', hint: `${mod}Y`, disabled: !e.can().redo(), run: () => chain().redo().run() },
    null,
    ...marks.map((m) => toggled(m, e.isActive(m.name))),
    { label: 'Link…', checked: e.isActive('link'), run: openLink },
    null,
    ...STYLES.map((s) => ({ label: s.label, checked: blockType.value === s.key, run: () => applyStyle(e, s.key) })),
    { label: 'Styles and fonts…', run: () => emit('panel', 'styles') },
    null,
    ...blocks.map((b) => toggled(b, e.isActive(b.name))),
    ...directions.map((d) => ({ label: d.label, checked: directionAt(e.state) === d.dir, run: () => chain().toggleDirection(d.dir).run() })),
    ...(has('insertSection') ? [null, ...layoutItems().filter((i) => !i || !i.label.startsWith('Section break'))] : []),
    null,
    { label: 'Header and footer scripts…', run: () => emit('panel', 'scripts') },
    { label: 'Document CSS…', run: () => emit('panel', 'css') },
  ]
}
function insertItems() {
  return [
    { label: 'Image…', run: () => imageInput.value.click() },
    has('insertHtmlBlock') && { label: 'HTML block', run: () => chain().insertHtmlBlock().run() },
    has('insertMermaid') && { label: 'Chart (Mermaid)', run: () => chain().insertMermaid().run() },
    { label: 'Divider line', run: () => chain().setHorizontalRule().run() },
    has('insertTableOfContents') && { label: 'Table of contents', run: () => chain().insertTableOfContents().run() },
    has('insertSection') && { label: 'Section break (next page)', disabled: !sectionAt(props.editor.state), run: () => chain().insertSection().run() },
    null,
    ...tableItems.value,
    ...(has('insertNote') ? [null, ...noteItems()] : []),
    ...(has('insertCaption') ? [null, ...captionItems()] : []),
  ].filter((i) => i !== false)
}

// Help menu: each topic opens the Help panel (HelpPanel.vue) at that topic.
const helpItems = [
  ...HELP_TOPICS.map((t) => ({ label: t.title, run: () => emit('help', t.key) })),
  null,
  { label: 'About MaTex', run: () => emit('help', 'about') },
]

const imageInput = ref(null)
function onImagePicked(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) emit('image', file)
}
</script>

<template>
  <header v-if="editor" class="toolbar">
    <div class="titlebar">
      <!-- Icon, then the menus as Fluent tabs; the document name stays centred on the window. -->
      <div class="title-start">
        <img :src="appIcon" alt="" width="20" height="20" />
        <nav class="menubar" aria-label="Menu">
          <ToolbarMenu label="File" :items="fileItems" :chevron="false" />
          <ToolbarMenu label="Edit" :items="editItems()" :chevron="false" />
          <ToolbarMenu label="Insert" :items="insertItems()" :chevron="false" />
          <ToolbarMenu label="Help" :items="helpItems" :chevron="false" />
        </nav>
      </div>
      <!-- Office keeps the document name centred in the title bar, its save state beside it. -->
      <span class="doc-title">
        <span class="doc-name">{{ name }}</span>
        <span v-if="dirty" class="doc-state">Unsaved changes</span>
      </span>
    </div>

    <div class="cmdbar" role="toolbar" aria-label="Formatting">
      <!-- Word's Home ribbon: groups of two button rows with a caption under each. -->
      <div class="tb-group" role="group" aria-label="Undo">
        <div class="tb-row">
          <button type="button" class="tb-btn" title="Undo" aria-label="Undo" :disabled="!editor.can().undo()" @click="chain().undo().run()">
            <Undo2 :size="18" />
          </button>
        </div>
        <div class="tb-row">
          <button type="button" class="tb-btn" title="Redo" aria-label="Redo" :disabled="!editor.can().redo()" @click="chain().redo().run()">
            <Redo2 :size="18" />
          </button>
        </div>
        <span class="tb-label" aria-hidden="true">Undo</span>
      </div>

      <div class="tb-group" role="group" aria-label="Font">
        <div class="tb-row">
          <span class="tb-select-wrap">
            <select class="tb-select" aria-label="Text style" :value="blockType" @change="applyStyle(editor, $event.target.value)">
              <option v-for="s in STYLES" :key="s.key" :value="s.key">{{ s.label }}</option>
            </select>
            <ChevronDown :size="16" aria-hidden="true" />
          </span>
          <button
            type="button" class="tb-btn" title="Styles and fonts" aria-label="Styles and fonts"
            :aria-pressed="panel === 'styles'" @click="emit('panel', 'styles')"
          >
            <CaseSensitive :size="18" />
          </button>
        </div>
        <div class="tb-row">
          <button
            v-for="m in marks" :key="m.name" type="button" class="tb-btn"
            :title="`${m.label} (${m.hint})`" :aria-label="m.label"
            :aria-pressed="editor.isActive(m.name)" @click="m.run"
          >
            <component :is="m.icon" :size="18" />
          </button>

          <div class="link-wrap">
            <button
              type="button" class="tb-btn" title="Link" aria-label="Link"
              :aria-pressed="editor.isActive('link')" :aria-expanded="linkOpen" @click="linkOpen ? (linkOpen = false) : openLink()"
            >
              <Link :size="18" />
            </button>
            <Transition name="menu">
              <form v-if="linkOpen" class="link-pop" @submit.prevent="applyLink" @keydown.esc="linkOpen = false">
                <input ref="linkInput" v-model="linkUrl" type="url" placeholder="https://" aria-label="Link address" dir="ltr" />
                <button type="submit" class="pop-btn primary">Apply</button>
                <button v-if="editor.isActive('link')" type="button" class="pop-btn" @click="removeLink">Remove</button>
              </form>
            </Transition>
          </div>
        </div>
        <span class="tb-label" aria-hidden="true">Font</span>
      </div>

      <div class="tb-group" role="group" aria-label="Paragraph">
        <div class="tb-row">
          <button
            v-for="b in blocks" :key="b.name" type="button" class="tb-btn"
            :title="b.label" :aria-label="b.label" :aria-pressed="editor.isActive(b.name)" @click="b.run"
          >
            <component :is="b.icon" :size="18" />
          </button>
        </div>
        <div class="tb-row">
          <button
            v-for="d in directions" :key="d.dir" type="button" class="tb-btn"
            :title="d.label" :aria-label="d.label" :aria-pressed="directionAt(editor.state) === d.dir"
            @click="chain().toggleDirection(d.dir).run()"
          >
            <component :is="d.icon" :size="18" />
          </button>
          <button type="button" class="tb-btn" title="Divider line" aria-label="Divider line" @click="chain().setHorizontalRule().run()">
            <Minus :size="18" />
          </button>
        </div>
        <span class="tb-label" aria-hidden="true">Paragraph</span>
      </div>

      <div class="tb-group" role="group" aria-label="Insert">
        <div class="tb-row">
          <button type="button" class="tb-btn" title="Insert image" aria-label="Insert image" @click="imageInput.click()">
            <Image :size="18" />
          </button>
          <input ref="imageInput" type="file" accept="image/*" hidden @change="onImagePicked" />

          <ToolbarMenu label="Table" :items="tableItems">
            <Table :size="18" aria-hidden="true" />
          </ToolbarMenu>

          <button
            v-if="editor.commands.insertHtmlBlock"
            type="button" class="tb-btn" title="HTML block" aria-label="HTML block" @click="chain().insertHtmlBlock().run()">
            <CodeXml :size="18" />
          </button>

          <button
            v-if="editor.commands.insertMermaid"
            type="button" class="tb-btn" title="Chart (Mermaid)" aria-label="Chart (Mermaid)" @click="chain().insertMermaid().run()">
            <Workflow :size="18" />
          </button>
        </div>
        <div class="tb-row">
          <button
            v-if="editor.commands.insertTableOfContents"
            type="button" class="tb-btn" title="Table of contents" aria-label="Table of contents" @click="chain().insertTableOfContents().run()">
            <TableOfContents :size="18" />
          </button>

          <ToolbarMenu v-if="editor.commands.insertNote" label="Footnotes and references" :items="noteItems()">
            <Superscript :size="18" aria-hidden="true" />
          </ToolbarMenu>

          <ToolbarMenu v-if="editor.commands.insertCaption" label="Captions and cross-references" :items="captionItems()">
            <Captions :size="18" aria-hidden="true" />
          </ToolbarMenu>
        </div>
        <span class="tb-label" aria-hidden="true">Insert</span>
      </div>

      <div v-if="pic" class="tb-group tb-context" role="group" aria-label="Picture">
        <div class="tb-row">
          <label class="tb-num" title="Width, as a share of the text column (empty = natural size)">
            <span>Width</span>
            <input type="number" min="5" max="100" step="5" placeholder="auto" :value="pic.width ?? ''" aria-label="Picture width in percent" @change="setWidth" />
            <span>%</span>
          </label>
          <button
            v-for="a in picAligns" :key="a.align" type="button" class="tb-btn" :title="a.label" :aria-label="a.label"
            :aria-pressed="pic.align === a.align" @click="alignPic(a.align)"
          >
            <component :is="a.icon" :size="18" />
          </button>
          <button type="button" class="tb-btn" title="Wrap text around the picture" aria-label="Wrap text" :aria-pressed="pic.wrap" @click="toggleWrap">
            <TextWrap :size="18" />
          </button>
        </div>
        <div class="tb-row">
          <ToolbarMenu label="Filter" :items="filterItems">
            <Contrast :size="18" aria-hidden="true" />
          </ToolbarMenu>
          <div class="link-wrap">
            <button
              type="button" class="tb-btn" title="Brightness and contrast" aria-label="Brightness and contrast"
              :aria-expanded="adjustOpen" @click="adjustOpen = !adjustOpen"
            >
              <SunDim :size="18" />
            </button>
            <Transition name="menu">
              <div v-if="adjustOpen" class="link-pop adjust-pop" @keydown.esc="adjustOpen = false">
                <label v-for="k in ['brightness', 'contrast']" :key="k">
                  <span>{{ capitalize(k) }}</span>
                  <input type="range" min="0" max="200" step="5" :value="pic[k]" @input="setPic({ [k]: +$event.target.value })" />
                  <output>{{ pic[k] }}%</output>
                </label>
                <div class="adjust-actions">
                  <button type="button" class="pop-btn" @click="setPic({ brightness: 100, contrast: 100 })">Reset</button>
                  <button type="button" class="pop-btn primary" @click="adjustOpen = false">Done</button>
                </div>
              </div>
            </Transition>
          </div>
          <button type="button" class="tb-btn" title="Rotate left 90°" aria-label="Rotate left" @click="emit('rotate', -1)">
            <RotateCcw :size="18" />
          </button>
          <button type="button" class="tb-btn" title="Rotate right 90°" aria-label="Rotate right" @click="emit('rotate', 1)">
            <RotateCw :size="18" />
          </button>
          <button type="button" class="tb-btn" title="Flip horizontally" aria-label="Flip horizontally" :aria-pressed="pic.flipH" @click="setPic({ flipH: !pic.flipH })">
            <FlipHorizontal2 :size="18" />
          </button>
          <button type="button" class="tb-btn" title="Flip vertically" aria-label="Flip vertically" :aria-pressed="pic.flipV" @click="setPic({ flipV: !pic.flipV })">
            <FlipVertical2 :size="18" />
          </button>
        </div>
        <span class="tb-label" aria-hidden="true">Picture</span>
      </div>

      <div class="tb-group" role="group" aria-label="Layout">
        <div class="tb-row">
          <ToolbarMenu v-if="editor.commands.insertSection" label="Layout: columns and sections" :items="layoutItems()">
            <Columns2 :size="18" aria-hidden="true" />
          </ToolbarMenu>
        </div>
        <div class="tb-row">
          <button
            type="button" class="tb-btn" title="Header and footer scripts" aria-label="Header and footer scripts"
            :aria-pressed="panel === 'scripts'" @click="emit('panel', 'scripts')"
          >
            <Braces :size="18" />
          </button>
          <button
            type="button" class="tb-btn" title="Document CSS" aria-label="Document CSS"
            :aria-pressed="panel === 'css'" @click="emit('panel', 'css')"
          >
            <FileCode :size="18" />
          </button>
        </div>
        <span class="tb-label" aria-hidden="true">Layout</span>
      </div>
    </div>
  </header>
</template>
