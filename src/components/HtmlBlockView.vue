<script setup>
// Node view for an HTML block: its HTML drawn live (sanitized), and, while the block is selected, its
// code in a field under it. The field floats out of the text flow so typing doesn't move the page
// breaks. A new, empty block selects itself and puts the cursor in the field. Esc or Done: back to the text.
import { computed, ref, onMounted, nextTick } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import CodeEdit from './CodeEdit.vue'
import { cleanHtml, leaveBlock } from '../editor/html.js'

const props = defineProps(nodeViewProps)

const html = computed({
  get: () => props.node.attrs.html,
  set: (value) => props.updateAttributes({ html: value }),
})
const clean = computed(() => cleanHtml(html.value))
const code = ref(null)

onMounted(async () => {
  if (html.value) return
  props.editor.commands.setNodeSelection(props.getPos())
  await nextTick()
  // After the toolbar's focus(), which gives the page focus back on the next frame.
  requestAnimationFrame(() => code.value?.focus())
})

const done = () => leaveBlock(props.editor, props.getPos())
</script>

<template>
  <NodeViewWrapper class="html-block" data-html-block contenteditable="false">
    <div v-if="clean.trim()" class="html-render" dir="auto" v-html="clean" />
    <p v-else class="html-empty">HTML block</p>
    <div v-if="selected" class="html-pop" @keydown.esc.stop="done">
      <CodeEdit ref="code" v-model="html" language="html" label="HTML" :min-height="120" placeholder="<div align=&quot;center&quot;>…</div>" />
      <div class="note-pop-actions">
        <span class="html-note">Scripts and &lt;style&gt; are removed; style it in the CSS panel.</span>
        <button type="button" class="pop-btn primary" @click="done">Done</button>
      </div>
    </div>
  </NodeViewWrapper>
</template>
