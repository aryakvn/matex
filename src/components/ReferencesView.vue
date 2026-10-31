<script setup>
// Node view for the [REFERENCES] block: every reference in order of first citation, live.
// Clicking one opens its popup (App.vue) to edit the text.
import { ref, onBeforeUnmount } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { noteEntries, noteHtml, noteDir } from '../editor/notes.js'

const props = defineProps(nodeViewProps)

const refs = ref([])
const refresh = () => {
  refs.value = noteEntries(props.editor.state.doc).filter((e) => e.kind === 'reference')
}
refresh()
props.editor.on('notes', refresh)
onBeforeUnmount(() => props.editor.off('notes', refresh))

const edit = (entry, e) => props.editor.emit('noteClick', { id: entry.id, el: e.currentTarget })
</script>

<template>
  <NodeViewWrapper as="section" class="references" data-references contenteditable="false">
    <p class="refs-title">References</p>
    <p v-if="!refs.length" class="refs-empty">Insert references to fill this list.</p>
    <ol v-else class="refs-list">
      <li v-for="r in refs" :id="`reference-text-${r.number}`" :key="r.id" class="refs-item" :dir="noteDir(r.text)" @click="edit(r, $event)">
        <span class="refs-num">[{{ r.number }}]</span>
        <span v-if="r.text.trim()" class="refs-text" v-html="noteHtml(editor, r.text)" />
        <span v-else class="refs-text refs-blank">Click to write this reference</span>
      </li>
    </ol>
  </NodeViewWrapper>
</template>
