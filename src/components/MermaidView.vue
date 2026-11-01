<script setup>
// Node view for a Mermaid chart: the chart drawn live, and, while selected, its code in a popup
// under it (same popup as the HTML block). A new, empty chart selects itself and focuses the code.
// A syntax error shows in the popup (out of the text flow, so page breaks match print); the page keeps
// the last chart that drew.
import { computed, ref, watch, onMounted, nextTick } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import CodeEdit from './CodeEdit.vue'
import { renderMermaid } from '../editor/mermaid.js'
import { leaveBlock } from '../editor/html.js'

const props = defineProps(nodeViewProps)

const code = computed({
  get: () => props.node.attrs.code,
  set: (value) => props.updateAttributes({ code: value }),
})
const svg = ref('')
const error = ref('')
const field = ref(null)

let run = 0
let timer
async function draw(text) {
  const mine = ++run
  if (!text.trim()) { svg.value = ''; error.value = ''; return }
  try {
    const out = await renderMermaid(text)
    if (mine === run) { svg.value = out; error.value = '' }
  } catch (e) {
    if (mine === run) error.value = String(e?.message ?? e)
  }
}
// Typing redraws after a short pause, not on every key.
watch(code, (text) => { clearTimeout(timer); timer = setTimeout(() => draw(text), 300) })

onMounted(async () => {
  draw(code.value)
  if (code.value) return
  props.editor.commands.setNodeSelection(props.getPos())
  await nextTick()
  // After the toolbar's focus(), which gives the page focus back on the next frame.
  requestAnimationFrame(() => field.value?.focus())
})

const done = () => leaveBlock(props.editor, props.getPos())
</script>

<template>
  <NodeViewWrapper class="mermaid-block" contenteditable="false">
    <div v-if="svg" class="mermaid-render" v-html="svg" />
    <p v-else class="html-empty">{{ error ? 'Chart: syntax error, click to fix' : 'Chart' }}</p>
    <div v-if="selected" class="html-pop" @keydown.esc.stop="done">
      <p v-if="error" class="mermaid-error">{{ error }}</p>
      <CodeEdit ref="field" v-model="code" language="plaintext" label="Mermaid" :min-height="120" placeholder="flowchart LR&#10;  A[Start] --> B{Done?}&#10;  B -- yes --> C[End]" />
      <div class="note-pop-actions">
        <span class="html-note">Mermaid: flowchart, sequenceDiagram, pie, gantt, classDiagram, …</span>
        <button type="button" class="pop-btn primary" @click="done">Done</button>
      </div>
    </div>
  </NodeViewWrapper>
</template>
