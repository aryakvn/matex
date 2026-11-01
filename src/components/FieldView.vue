<script setup>
// Node view for a script field (editor/fields.js): its value, from the plugin's decoration, with
// Persian runs in the Persian font; while selected, its JavaScript in a popup under it. A new, empty
// field selects itself and focuses the code.
import { computed, ref, onMounted, nextTick } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import CodeEdit from './CodeEdit.vue'
import { persianRuns } from '../editor/persian.js'
import { leaveBlock } from '../editor/html.js'
import { showCode } from '../editor/fields.js'

const props = defineProps(nodeViewProps)

const code = computed({
  get: () => props.node.attrs.code,
  set: (value) => props.updateAttributes({ code: value }),
})
const value = computed(() => props.decorations?.find((d) => d.spec.field)?.spec.value ?? showCode(code.value))
const runs = computed(() => persianRuns(value.value))
const field = ref(null)

onMounted(async () => {
  if (code.value) return
  props.editor.commands.setNodeSelection(props.getPos())
  await nextTick()
  // After the toolbar's focus(), which gives the page focus back on the next frame.
  requestAnimationFrame(() => field.value?.focus())
})

const done = () => leaveBlock(props.editor, props.getPos())
</script>

<template>
  <NodeViewWrapper as="span" class="field" contenteditable="false">
    <template v-if="code.trim()">
      <span v-for="(r, i) in runs" :key="i" :class="{ persian: r.fa }">{{ r.text }}</span>
    </template>
    <span v-else class="html-empty">Field</span>
    <div v-if="selected" class="html-pop math-pop" @keydown.esc.stop="done">
      <CodeEdit ref="field" v-model="code" language="javascript" label="Field script" :min-height="40" placeholder="page.toLocaleString('fa')" />
      <div class="note-pop-actions">
        <span class="html-note">JavaScript, run per page; the Header &amp; footer scripts panel lists what it can use.</span>
        <button type="button" class="pop-btn primary" @click="done">Done</button>
      </div>
    </div>
  </NodeViewWrapper>
</template>
