<script setup>
// Dropdown for the toolbar: a button that opens a list of actions.
// Closes on choice, outside click, or Escape.
import { ref, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

defineProps({
  label: { type: String, required: true },
  // [{ label, hint?, disabled?, checked?, run }] ; null = divider. `checked` (true/false) makes a radio item.
  items: { type: Array, required: true },
  chevron: { type: Boolean, default: true },
})

const open = ref(false)
const root = ref(null)

function onOutside(e) {
  if (!root.value?.contains(e.target)) close()
}
function onKey(e) {
  if (e.key === 'Escape') close()
}
function toggle() {
  open.value ? close() : show()
}
function show() {
  open.value = true
  document.addEventListener('mousedown', onOutside)
  document.addEventListener('keydown', onKey)
}
function close() {
  open.value = false
  document.removeEventListener('mousedown', onOutside)
  document.removeEventListener('keydown', onKey)
}
function choose(item) {
  close()
  item.run()
}
onBeforeUnmount(close)
</script>

<template>
  <div ref="root" class="menu">
    <button type="button" class="tb-btn menu-btn" :aria-label="label" :title="label" :aria-expanded="open" aria-haspopup="menu" @click="toggle">
      <slot>{{ label }}</slot>
      <ChevronDown v-if="chevron" :size="14" aria-hidden="true" />
    </button>
    <Transition name="menu">
      <ul v-if="open" class="menu-list" role="menu" :aria-label="label">
        <template v-for="(item, i) in items" :key="i">
          <li v-if="!item" class="menu-sep" role="separator" />
          <li v-else role="none">
            <button
              type="button" :role="item.checked === undefined ? 'menuitem' : 'menuitemradio'" :aria-checked="item.checked"
              :disabled="item.disabled" @click="choose(item)"
            >
              <span>{{ item.label }}</span>
              <kbd v-if="item.hint">{{ item.hint }}</kbd>
              <Check v-if="item.checked" :size="16" aria-hidden="true" />
            </button>
          </li>
        </template>
      </ul>
    </Transition>
  </div>
</template>
