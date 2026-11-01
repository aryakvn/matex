<script setup>
// Node view for an equation (inline or block): KaTeX's drawing, and, while selected, its LaTeX in a
// popup under it (same popup as the HTML block, out of the text flow). A new, empty equation selects
// itself and focuses the code. Errors show in red in the drawing itself.
import { computed, ref, onMounted, nextTick } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import CodeEdit from './CodeEdit.vue'
import { renderMath } from '../editor/math.js'
import { leaveBlock } from '../editor/html.js'

const props = defineProps(nodeViewProps)

const block = computed(() => props.node.type.name === 'blockMath')
const latex = computed({
  get: () => props.node.attrs.latex,
  set: (value) => props.updateAttributes({ latex: value }),
})
const html = computed(() => (latex.value.trim() ? renderMath(latex.value, block.value) : ''))
const field = ref(null)

onMounted(async () => {
  if (latex.value) return
  props.editor.commands.setNodeSelection(props.getPos())
  await nextTick()
  // After the toolbar's focus(), which gives the page focus back on the next frame.
  requestAnimationFrame(() => field.value?.focus())
})

const done = () => leaveBlock(props.editor, props.getPos())
</script>

<template>
  <NodeViewWrapper :as="block ? 'div' : 'span'" :class="block ? 'block-math' : 'inline-math'" contenteditable="false">
    <component :is="block ? 'div' : 'span'" v-if="html" class="math-render" v-html="html" />
    <span v-else class="html-empty">Equation</span>
    <div v-if="selected" class="html-pop math-pop" @keydown.esc.stop="done">
      <CodeEdit ref="field" v-model="latex" language="plaintext" label="LaTeX" :min-height="block ? 80 : 40" placeholder="\frac{a}{b} + \sqrt{x^2 + y^2}" />
      <div class="note-pop-actions">
        <span class="html-note">LaTeX math, drawn by KaTeX (katex.org/docs/supported).</span>
        <button type="button" class="pop-btn primary" @click="done">Done</button>
      </div>
    </div>
  </NodeViewWrapper>
</template>
