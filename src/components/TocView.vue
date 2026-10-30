<script setup>
// Node view for the [TOC] block: lists the document's headings live. Each entry's "…" menu
// toggles the heading's `unlisted` flag; unlisted entries stay visible (faded) while editing
// so they can be brought back, and are hidden in print.
import { ref, onBeforeUnmount } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Ellipsis } from 'lucide-vue-next'
import ToolbarMenu from './ToolbarMenu.vue'
import { tocEntries } from '../editor/toc.js'

const props = defineProps(nodeViewProps)

const entries = ref(tocEntries(props.editor.state.doc))
const refresh = () => { entries.value = tocEntries(props.editor.state.doc) }
props.editor.on('update', refresh)
onBeforeUnmount(() => props.editor.off('update', refresh))

function jump(entry) {
  props.editor.chain().focus().setTextSelection(entry.pos + 1).scrollIntoView().run()
}

function setUnlisted(entry, unlisted) {
  const { tr } = props.editor.state
  props.editor.view.dispatch(tr.setNodeAttribute(entry.pos, 'unlisted', unlisted))
}

const menuItems = (entry) => [
  entry.unlisted
    ? { label: 'Include in table of contents', run: () => setUnlisted(entry, false) }
    : { label: 'Exclude from table of contents', run: () => setUnlisted(entry, true) },
]
</script>

<template>
  <NodeViewWrapper as="nav" class="toc" data-toc contenteditable="false">
    <p class="toc-title">Contents</p>
    <p v-if="!entries.length" class="toc-empty">Add headings to fill the table of contents.</p>
    <ol v-else class="toc-list">
      <li
        v-for="entry in entries" :key="entry.pos" dir="auto"
        :class="['toc-item', `toc-l${entry.level}`, { unlisted: entry.unlisted }]"
      >
        <a href="#" @click.prevent="jump(entry)">{{ entry.text }}</a>
        <ToolbarMenu label="Heading options" :items="menuItems(entry)" :chevron="false" class="toc-more">
          <Ellipsis :size="16" aria-hidden="true" />
        </ToolbarMenu>
      </li>
    </ol>
  </NodeViewWrapper>
</template>
