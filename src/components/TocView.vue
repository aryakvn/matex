<script setup>
// Node view for the [TOC] block: lists the document's headings live with the page each starts on.
// Each entry's "…" menu excludes that heading. Excluded headings leave the list (so the sheet looks
// as it prints) and are brought back from the eye-off menu in the margin. Both menus sit outside
// the text flow so they never move the page breaks.
import { ref, computed, onBeforeUnmount } from 'vue'
import { NodeViewWrapper, nodeViewProps } from '@tiptap/vue-3'
import { Ellipsis, EyeOff } from 'lucide-vue-next'
import ToolbarMenu from './ToolbarMenu.vue'
import { tocEntries } from '../editor/toc.js'
import { pageOf } from '../editor/pagination.js'
import { persianRuns, isRtl } from '../editor/persian.js'

const props = defineProps(nodeViewProps)

const entries = ref([])
function refresh() {
  const breaks = props.editor.storage.pagination?.breaks ?? []
  entries.value = tocEntries(props.editor.state.doc).map((e) => ({ ...e, page: pageOf(breaks, e.pos) }))
}
refresh()
props.editor.on('update', refresh)
props.editor.on('paginate', refresh)
onBeforeUnmount(() => {
  props.editor.off('update', refresh)
  props.editor.off('paginate', refresh)
})

const listed = computed(() => entries.value.filter((e) => !e.unlisted))
const excluded = computed(() => entries.value.filter((e) => e.unlisted))

function jump(entry) {
  props.editor.chain().focus().setTextSelection(entry.pos + 1).scrollIntoView().run()
}

function setUnlisted(entry, unlisted) {
  const { tr } = props.editor.state
  props.editor.view.dispatch(tr.setNodeAttribute(entry.pos, 'unlisted', unlisted))
}

const excludeItems = (entry) => [{ label: 'Exclude from table of contents', run: () => setUnlisted(entry, true) }]
const includeItems = computed(() => excluded.value.map((e) => ({ label: `Include “${e.text}”`, run: () => setUnlisted(e, false) })))
</script>

<template>
  <NodeViewWrapper as="nav" class="toc" data-toc contenteditable="false">
    <p class="toc-title">Contents</p>
    <ToolbarMenu
      v-if="excluded.length" :label="`Excluded headings (${excluded.length})`" :items="includeItems"
      :chevron="false" class="toc-more toc-excluded"
    >
      <EyeOff :size="16" aria-hidden="true" />
    </ToolbarMenu>
    <p v-if="!listed.length" class="toc-empty">Add headings to fill the table of contents.</p>
    <!-- The first heading sets which side the page numbers sit on. Not dir="auto": that skips the
         links, which have their own dir, and would always be left to right. -->
    <ol v-else class="toc-list" :dir="isRtl(listed[0].text) ? 'rtl' : 'ltr'">
      <li
        v-for="(entry, i) in listed" :id="`toc-entry-${i + 1}`" :key="entry.pos"
        :class="['toc-item', `toc-l${entry.level}`, { persian: isRtl(entry.text) }]"
      >
        <a href="#" class="toc-link" dir="auto" @click.prevent="jump(entry)"><span v-for="(r, i) in persianRuns(entry.text)" :key="i" :class="{ persian: r.fa }">{{ r.text }}</span></a>
        <span class="toc-dots" aria-hidden="true" />
        <span class="toc-page">{{ entry.page }}</span>
        <ToolbarMenu label="Heading options" :items="excludeItems(entry)" :chevron="false" class="toc-more">
          <Ellipsis :size="16" aria-hidden="true" />
        </ToolbarMenu>
      </li>
    </ol>
  </NodeViewWrapper>
</template>
