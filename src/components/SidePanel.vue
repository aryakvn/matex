<script setup>
// Right-hand task pane (like Word's): a titled, closable column docked beside the pages, under the
// toolbar; the page area shrinks to make room (App.vue). v-model:open shows and hides it; Esc or × closes.
// `help`: the panel has help text, so a ? button shows it; the content gets it as the slot's `showHelp`.
// v-model:show-help lets the owner open the panel with its help already showing.
import { X, CircleQuestionMark } from 'lucide-vue-next'

defineProps({
  title: { type: String, required: true },
  help: { type: Boolean, default: false },
})
const open = defineModel('open', { type: Boolean, default: false })
const showHelp = defineModel('showHelp', { type: Boolean, default: false })
</script>

<template>
  <Transition name="side">
    <aside v-if="open" class="side" :aria-label="title" @keydown.esc="open = false">
      <!-- The aside's width animates (pushing the pages aside); this keeps the content full width. -->
      <div class="side-inner">
      <header class="side-head">
        <h2>{{ title }}</h2>
        <button
          v-if="help" type="button" class="tb-btn" title="Help" aria-label="Help"
          :aria-pressed="showHelp" @click="showHelp = !showHelp"
        >
          <CircleQuestionMark :size="20" />
        </button>
        <button type="button" class="tb-btn side-close" title="Close" aria-label="Close" @click="open = false">
          <X :size="20" />
        </button>
      </header>
      <div class="side-body"><slot :show-help="showHelp" /></div>
      </div>
    </aside>
  </Transition>
</template>
