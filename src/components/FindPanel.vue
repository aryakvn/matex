<script>
import { ref, reactive } from 'vue'

// Kept while the panel is closed, so reopening it shows the last search, like Word.
const query = ref('')
const replacement = ref('')
const options = reactive({ caseSensitive: false, wholeWord: false, regex: false })
</script>

<script setup>
// Side panel content: Find and replace in the body text (editor/search.js). Matches are highlighted
// on the page while the panel is open. In Find, Enter = next match and Shift+Enter = previous; in
// Replace with, Enter replaces the selected match and moves on.
import { computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { ChevronUp, ChevronDown } from 'lucide-vue-next'
import { searchState } from '../editor/search.js'

const props = defineProps({
  editor: { type: Object, default: null }, // the body editor
})

const note = ref('') // "Replaced 5." after Replace all, until the search changes
watch([query, options, () => props.editor], () => {
  note.value = ''
  props.editor?.commands.setSearch({ query: query.value, ...options })
}, { immediate: true, deep: true })
onBeforeUnmount(() => props.editor?.commands.setSearch({ query: '' }))

const found = computed(() => (props.editor ? searchState(props.editor.state) : { matches: [], index: -1, error: null }))
const count = computed(() => found.value.matches.length)
const status = computed(() => {
  const { error, index } = found.value
  if (error) return `Invalid pattern: ${error}`
  if (note.value) return note.value
  if (!query.value) return ''
  if (!count.value) return 'No results'
  return index >= 0 ? `${index + 1} of ${count.value}` : `${count.value} ${count.value === 1 ? 'result' : 'results'}`
})

const next = (backwards = false) => props.editor?.commands.findNext(backwards)
const replaceNext = () => props.editor?.commands.replaceNext(replacement.value)
function replaceAll() {
  const n = count.value
  if (props.editor?.commands.replaceAll(replacement.value)) note.value = `Replaced ${n}.`
}

// Ctrl+F / Ctrl+H (App.vue): focus a field. A short selection on the page (not a match already)
// becomes the query, as in Word.
const findInput = ref(null)
const replaceInput = ref(null)
async function focus(field = 'find') {
  const e = props.editor
  const { from, to, empty } = e?.state.selection ?? { empty: true }
  if (!empty && found.value.index < 0) {
    const text = e.state.doc.textBetween(from, to, '\n')
    if (text.trim() && !text.includes('\n') && text.length <= 200) query.value = text
  }
  await nextTick()
  const input = field === 'replace' && query.value ? replaceInput.value : findInput.value
  input?.focus()
  input?.select()
}
defineExpose({ focus })
</script>

<template>
  <form class="find" @submit.prevent>
    <label class="find-field">
      <span>Find</span>
      <input
        ref="findInput" v-model="query" type="text" dir="auto" spellcheck="false" autocomplete="off"
        @keydown.enter.exact.prevent="next()" @keydown.shift.enter.prevent="next(true)"
      />
    </label>
    <div class="find-nav">
      <output :class="['find-status', { error: found.error }]" aria-live="polite">{{ status }}</output>
      <button type="button" class="tb-btn" title="Previous (Shift+Enter)" aria-label="Previous result" :disabled="!count" @click="next(true)">
        <ChevronUp :size="18" />
      </button>
      <button type="button" class="tb-btn" title="Next (Enter)" aria-label="Next result" :disabled="!count" @click="next()">
        <ChevronDown :size="18" />
      </button>
    </div>

    <label class="find-field">
      <span>Replace with</span>
      <input
        ref="replaceInput" v-model="replacement" type="text" dir="auto" spellcheck="false" autocomplete="off"
        @keydown.enter.prevent="replaceNext"
      />
    </label>
    <div class="find-actions">
      <button type="button" class="pop-btn" :disabled="!count" @click="replaceNext">Replace</button>
      <button type="button" class="pop-btn" :disabled="!count" @click="replaceAll">Replace all</button>
    </div>

    <fieldset class="find-options">
      <legend>Options</legend>
      <label class="check"><input v-model="options.caseSensitive" type="checkbox" /> Match case</label>
      <label class="check"><input v-model="options.wholeWord" type="checkbox" /> Whole words only</label>
      <label class="check"><input v-model="options.regex" type="checkbox" /> Regular expression</label>
    </fieldset>
    <p class="ref-hint">
      Searches the body text, captions included; not footnote text, headers or footers.
      Without Match case, Arabic ي and ك also find Persian ی and ک.
      With Regular expression, Replace with can use <code>$1</code>, <code>$&amp;</code> and <code>$&lt;name&gt;</code>.
    </p>
  </form>
</template>
