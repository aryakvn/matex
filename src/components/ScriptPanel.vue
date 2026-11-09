<script setup>
// Side panel content: the document script (layout.script, saved as script.js), the CssPanel of
// JavaScript. runScript (utils/scripts.js) prepends it to every {{ }} field, so what it declares is
// in scope there.
import CodeEdit from './CodeEdit.vue'

const script = defineModel({ type: String, default: '' })
defineProps({
  scriptsOn: { type: Boolean, default: true },
  showHelp: { type: Boolean, default: false },
})
const emit = defineEmits(['fields'])
</script>

<template>
  <p v-if="!scriptsOn" class="ref-warn">Scripts are turned off for this document, so fields show their code. Reopen it and choose to run them.</p>

  <div v-if="showHelp" class="ref-text">
    <p>
      Functions and variables declared here can be used in every <code v-pre>{{ }}</code> of the document:
      text, tables, captions, notes, headers and footers. Saved with the document as <code>script.js</code>.
    </p>
    <p>
      It runs before each field, so it can read that field's variables (<code>page</code>, <code>pages</code>,
      <code>number</code>, <code>title</code>, <code>date</code>), for example
      <code>function chapter() { return page &lt; 10 ? 'Part 1' : 'Part 2' }</code> then
      <code v-pre>{{ chapter() }}</code>.
    </p>
  </div>
  <p v-else class="ref-hint">
    Use what you declare here in any <code v-pre>{{ }}</code>.
    <button type="button" class="pop-btn" @click="emit('fields')">Variables and examples</button>
  </p>

  <CodeEdit
    v-model="script" language="javascript" label="Document script"
    placeholder="function chapter() { return page < 10 ? 'Part 1' : 'Part 2' }"
  />
</template>
