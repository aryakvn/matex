<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { editorOptions } from './editor/extensions.js'
import EditorToolbar from './components/EditorToolbar.vue'
import { useDocument } from './composables/useDocument.js'
import { onCloseRequest } from './utils/platform.js'
import { fileAction } from './utils/keys.js'

const images = (list) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

const editor = useEditor({
  ...editorOptions,
  content: '',
  autofocus: true,
  editorProps: {
    handlePaste(view, event) {
      const files = images(event.clipboardData?.files)
      if (!files.length) return false
      files.forEach((f) => doc.insertImage(f))
      return true
    },
    handleDrop(view, event, slice, moved) {
      const files = moved ? [] : images(event.dataTransfer?.files)
      if (!files.length) return false
      const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
      files.forEach((f) => doc.insertImage(f, pos))
      return true
    },
  },
})

const doc = useDocument(editor)
const { name, dirty } = doc

const fileActions = { new: doc.newDoc, open: doc.openDoc, save: doc.save, saveAs: doc.saveAs }

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
  <EditorToolbar :editor="editor" :name="name" :dirty="dirty" @file="fileActions[$event]()" @image="doc.insertImage" />
  <main class="desk">
    <article class="page">
      <EditorContent :editor="editor" />
    </article>
  </main>
</template>
