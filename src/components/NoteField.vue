<script setup>
// Rich one-line editor for a note's text (a footnote at the sheet bottom, or a popup). Every edit is
// written straight into the body's markers, so undo, dirty state and page breaks follow it.
import { onMounted, onUnmounted } from 'vue'
import { Editor, EditorContent } from '@tiptap/vue-3'
import { slotEditorOptions } from '../editor/extensions.js'

const props = defineProps({
  body: { type: Object, required: true }, // the document's editor
  id: { type: String, required: true },
  text: { type: String, default: '' },
})
const emit = defineEmits(['focus', 'done'])

const ed = new Editor({
  ...slotEditorOptions,
  content: props.text,
  onUpdate: () => props.body.commands.setNoteText(props.id, ed.getMarkdown()),
  onFocus: () => emit('focus', ed),
  // One line: Enter and Esc finish.
  editorProps: {
    handleKeyDown: (view, e) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return false
      emit('done')
      return true
    },
  },
})

onMounted(() => {
  ed.commands.focus('end')
  ed.view.dom.scrollIntoView({ block: 'nearest' })
})
onUnmounted(() => ed.destroy())
</script>

<template>
  <EditorContent :editor="ed" class="note-field" />
</template>
