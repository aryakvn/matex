<script setup>
import { useEditor, EditorContent } from '@tiptap/vue-3'
import { editorOptions } from './editor/extensions.js'

const editor = useEditor({ ...editorOptions, content: '' })
</script>

<template>
  <main class="desk">
    <article class="page">
      <EditorContent :editor="editor" />
    </article>
  </main>
</template>
