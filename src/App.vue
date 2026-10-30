<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { editorOptions } from './editor/extensions.js'
import EditorToolbar from './components/EditorToolbar.vue'

const editor = useEditor({ ...editorOptions, content: '' })
</script>

<template>
  <EditorToolbar :editor="editor" />
  <main class="desk">
    <article class="page">
      <EditorContent :editor="editor" />
    </article>
  </main>
</template>
