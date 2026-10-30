<script setup>
// Title strip + Fluent-style command bar for a Tiptap editor. Formatting runs straight on the editor;
// file actions and picked images go up as events so the owner decides what they mean.
import { computed, ref, nextTick } from 'vue'
import {
  Undo2, Redo2, Bold, Italic, Strikethrough, Code, Link, List, ListOrdered,
  Quote, Minus, Image, Table, ChevronDown,
} from 'lucide-vue-next'
import ToolbarMenu from './ToolbarMenu.vue'
import appIcon from '../../src-tauri/icons/64x64.png'

const props = defineProps({
  editor: { type: Object, default: null },
  name: { type: String, default: '' },
  dirty: { type: Boolean, default: false },
})
const emit = defineEmits(['file', 'image'])

const mod = /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl+'
const chain = () => props.editor.chain().focus()

const fileItems = [
  { label: 'New', hint: `${mod}N`, run: () => emit('file', 'new') },
  { label: 'Open…', hint: `${mod}O`, run: () => emit('file', 'open') },
  null,
  { label: 'Save', hint: `${mod}S`, run: () => emit('file', 'save') },
  { label: 'Save as…', hint: `${mod}Shift+S`, run: () => emit('file', 'saveAs') },
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

const blockTypes = [
  { value: 'p', label: 'Normal text' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'code', label: 'Code block' },
]

const blockType = computed(() => {
  const e = props.editor
  if (!e) return 'p'
  for (const level of [1, 2, 3]) if (e.isActive('heading', { level })) return `h${level}`
  if (e.isActive('codeBlock')) return 'code'
  return 'p'
})

function setBlockType(value) {
  if (value === 'p') chain().setParagraph().run()
  else if (value === 'code') chain().setCodeBlock().run()
  else chain().setHeading({ level: Number(value[1]) }).run()
}

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
        <select class="tb-select" aria-label="Text style" :value="blockType" @change="setBlockType($event.target.value)">
          <option v-for="t in blockTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
        <ChevronDown :size="16" aria-hidden="true" />
      </span>

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

      <button type="button" class="tb-btn" title="Insert image" aria-label="Insert image" @click="imageInput.click()">
        <Image :size="20" />
      </button>
      <input ref="imageInput" type="file" accept="image/*" hidden @change="onImagePicked" />

      <ToolbarMenu label="Table" :items="tableItems">
        <Table :size="20" aria-hidden="true" />
      </ToolbarMenu>
    </div>
  </header>
</template>
