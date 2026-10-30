<script setup>
// Node view for the [TOC] block: lists the document's headings live, each with its printed page
// number. Each entry's "…" menu toggles the heading's `unlisted` flag; unlisted entries stay
// visible (faded) while editing so they can be brought back, and are hidden in print.
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Ellipsis } from 'lucide-vue-next'
import ToolbarMenu from './ToolbarMenu.vue'
import { tocEntries, pageAt } from '../editor/toc.js'

const props = defineProps(nodeViewProps)

const entries = ref(tocEntries(props.editor.state.doc))

function refresh() {
  const { view, state } = props.editor
  const top = view.dom.getBoundingClientRect().top
  // TOC rows hidden in print take no room on paper, so they don't push headings down.
  const unprinted = [...view.dom.querySelectorAll('.toc .unlisted, .toc-empty')].map((el) => el.getBoundingClientRect())
  entries.value = tocEntries(state.doc).map((entry) => {
    const el = view.nodeDOM(entry.pos)
    if (!el?.getBoundingClientRect) return entry
    const y = el.getBoundingClientRect().top
    const skipped = unprinted.reduce((sum, r) => (r.top < y ? sum + r.height : sum), 0)
    return { ...entry, page: pageAt(y - top - skipped) }
  })
}

// Text edits fire `update`; images loading and window resizes only change the size.
const resized = new ResizeObserver(refresh)
props.editor.on('update', refresh)
onMounted(() => resized.observe(props.editor.view.dom))
onBeforeUnmount(() => {
  props.editor.off('update', refresh)
  resized.disconnect()
})

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
    <!-- dir="auto" on the list: the first heading sets which side the page numbers sit on. -->
    <ol v-else class="toc-list" dir="auto">
      <li v-for="entry in entries" :key="entry.pos" :class="['toc-item', `toc-l${entry.level}`, { unlisted: entry.unlisted }]">
        <a href="#" dir="auto" @click.prevent="jump(entry)">{{ entry.text }}</a>
        <span class="toc-dots" aria-hidden="true" />
        <span class="toc-page">{{ entry.page }}</span>
        <ToolbarMenu label="Heading options" :items="menuItems(entry)" :chevron="false" class="toc-more">
          <Ellipsis :size="16" aria-hidden="true" />
        </ToolbarMenu>
      </li>
    </ol>
  </NodeViewWrapper>
</template>
