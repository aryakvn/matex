<script setup>
// Title strip + Fluent-style command bar for a Tiptap editor. Formatting runs straight on the editor;
// file actions and picked images go up as events so the owner decides what they mean.
import { computed, ref, nextTick } from 'vue'
import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Code, Link, List, ListOrdered,
  Quote, Minus, Image, Table, TableOfContents, ChevronDown, PilcrowRight, PilcrowLeft, Braces, FileCode, CodeXml, CaseSensitive, Superscript, Columns2, Captions,
} from 'lucide-vue-next'
import ToolbarMenu from './ToolbarMenu.vue'
import { directionAt } from '../editor/direction.js'
import { noteEntries } from '../editor/notes.js'
import { captionEntries } from '../editor/captions.js'
import { sectionAt, MAX_COLUMNS } from '../editor/sections.js'
import { canWrapColumns } from '../utils/layout.js'
import { STYLES, styleAt, applyStyle } from '../utils/styles.js'
import appIcon from '../../src-tauri/icons/64x64.png'

const props = defineProps({
  editor: { type: Object, default: null },
  name: { type: String, default: '' },
  dirty: { type: Boolean, default: false },
  panel: { type: String, default: null }, // the side panel that is open, if any
})
const emit = defineEmits(['file', 'image', 'panel', 'note', 'sectionCss'])

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
    { label: can ? 'Add caption' : 'Add caption (select an image, table or HTML block)', disabled: !can, run: () => chain().insertCaption().run() },
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
      <img :src="appIcon" alt="" width="20" height="20" />
      <span class="doc-name">{{ name }}</span>
      <span v-if="dirty" class="doc-state">Unsaved changes</span>
    </div>

    <div class="cmdbar" role="toolbar" aria-label="Formatting">
      <ToolbarMenu label="File" :items="fileItems" />

      <span class="tb-sep" />

      <button type="button" class="tb-btn" title="Undo" aria-label="Undo" :disabled="!editor.can().undo()" @click="chain().undo().run()">
        <Undo2 :size="20" />
      </button>
      <button type="button" class="tb-btn" title="Redo" aria-label="Redo" :disabled="!editor.can().redo()" @click="chain().redo().run()">
        <Redo2 :size="20" />
      </button>

      <span class="tb-sep" />

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
        <CaseSensitive :size="20" />
      </button>

      <span class="tb-sep" />

      <button
        v-for="m in marks" :key="m.name" type="button" class="tb-btn"
        :title="`${m.label} (${m.hint})`" :aria-label="m.label"
        :aria-pressed="editor.isActive(m.name)" @click="m.run"
      >
        <component :is="m.icon" :size="20" />
      </button>

      <div class="link-wrap">
        <button
          type="button" class="tb-btn" title="Link" aria-label="Link"
          :aria-pressed="editor.isActive('link')" :aria-expanded="linkOpen" @click="linkOpen ? (linkOpen = false) : openLink()"
        >
          <Link :size="20" />
        </button>
        <Transition name="menu">
          <form v-if="linkOpen" class="link-pop" @submit.prevent="applyLink" @keydown.esc="linkOpen = false">
            <input ref="linkInput" v-model="linkUrl" type="url" placeholder="https://" aria-label="Link address" dir="ltr" />
            <button type="submit" class="pop-btn primary">Apply</button>
            <button v-if="editor.isActive('link')" type="button" class="pop-btn" @click="removeLink">Remove</button>
          </form>
        </Transition>
      </div>

      <span class="tb-sep" />

      <button
        v-for="b in blocks" :key="b.name" type="button" class="tb-btn"
        :title="b.label" :aria-label="b.label" :aria-pressed="editor.isActive(b.name)" @click="b.run"
      >
        <component :is="b.icon" :size="20" />
      </button>
      <button type="button" class="tb-btn" title="Divider line" aria-label="Divider line" @click="chain().setHorizontalRule().run()">
        <Minus :size="20" />
      </button>

      <span class="tb-sep" />

      <button
        v-for="d in directions" :key="d.dir" type="button" class="tb-btn"
        :title="d.label" :aria-label="d.label" :aria-pressed="directionAt(editor.state) === d.dir"
        @click="chain().toggleDirection(d.dir).run()"
      >
        <component :is="d.icon" :size="20" />
      </button>

      <span class="tb-sep" />

      <button type="button" class="tb-btn" title="Insert image" aria-label="Insert image" @click="imageInput.click()">
        <Image :size="20" />
      </button>
      <input ref="imageInput" type="file" accept="image/*" hidden @change="onImagePicked" />

      <button
        v-if="editor.commands.insertTableOfContents"
        type="button" class="tb-btn" title="Table of contents" aria-label="Table of contents" @click="chain().insertTableOfContents().run()">
        <TableOfContents :size="20" />
      </button>
      <button
        v-if="editor.commands.insertHtmlBlock"
        type="button" class="tb-btn" title="HTML block" aria-label="HTML block" @click="chain().insertHtmlBlock().run()">
        <CodeXml :size="20" />
      </button>

      <ToolbarMenu v-if="editor.commands.insertNote" label="Footnotes and references" :items="noteItems()">
        <Superscript :size="20" aria-hidden="true" />
      </ToolbarMenu>

      <ToolbarMenu v-if="editor.commands.insertCaption" label="Captions and cross-references" :items="captionItems()">
        <Captions :size="20" aria-hidden="true" />
      </ToolbarMenu>

      <ToolbarMenu v-if="editor.commands.insertSection" label="Layout: columns and sections" :items="layoutItems()">
        <Columns2 :size="20" aria-hidden="true" />
      </ToolbarMenu>

      <ToolbarMenu label="Table" :items="tableItems">
        <Table :size="20" aria-hidden="true" />
      </ToolbarMenu>

      <span class="tb-sep" />

      <button
        type="button" class="tb-btn" title="Header and footer scripts" aria-label="Header and footer scripts"
        :aria-pressed="panel === 'scripts'" @click="emit('panel', 'scripts')"
      >
        <Braces :size="20" />
      </button>
      <button
        type="button" class="tb-btn" title="Document CSS" aria-label="Document CSS"
        :aria-pressed="panel === 'css'" @click="emit('panel', 'css')"
      >
        <FileCode :size="20" />
      </button>
    </div>
  </header>
</template>
